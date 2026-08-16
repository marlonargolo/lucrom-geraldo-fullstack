import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs/promises';
import { FormatExport, ExportFormatKind, FormatExportResult, FormatExportOverallStatus } from './format-export.entity';
import { CreateFormatExportDto, ALL_FORMATS } from './dto/create-format-export.dto';
import { FfmpegService } from '../ffmpeg.service';
import { MediaAssetsService } from '../../../media-assets/media-assets.service';
import { GraphicComposerService } from '../../../creative/graphic-composer/graphic-composer.service';
import { ComposeGraphicDto, GraphicSlideDto } from '../../../creative/graphic-composer/dto/compose-graphic.dto';
import { Script } from '../../../creative/script-generator/script.entity';

/** Shape esperado de `scripts.contract` (ver ScriptGeneratorService). */
interface ScriptContract {
  hook: string;
  roteiro: { segment: string; text: string; duration_seconds_estimate?: number }[];
  cta: string;
  legenda_social: string;
  hashtags: string[];
}

type VideoFormat = Exclude<ExportFormatKind, 'carousel'>;

/** Aspect ratio por formato de vídeo, consumido por `FfmpegService.cropToAspectRatio`. */
const ASPECT_RATIO_BY_FORMAT: Record<VideoFormat, '9:16' | '16:9' | '1:1' | '4:5'> = {
  reels: '9:16',
  story: '9:16',
  feed_square: '1:1',
  feed_portrait: '4:5',
};

/** Máximo de slides "de meio" (roteiro) no carrossel — hook (1) + meio (até 8) + cta (1) = 10, o teto do ComposeGraphicDto. */
const MAX_ROTEIRO_SLIDES = 8;

/**
 * Export automático multi-formato (engines/m8/format-export) — conecta o que
 * já existia (`FfmpegService.cropToAspectRatio()`, `GraphicComposerService.compose()`,
 * `Script.contract`) numa única operação de produto: a partir de uma peça já
 * gerada, produz de uma vez Reels, Story, Feed quadrado, Feed retrato e
 * Carrossel.
 *
 * Cada formato roda de forma independente — a falha de um (ex.: carrossel
 * pedido sem `script_id`) não impede os demais. Ver `results` na entidade.
 *
 * Processamento síncrono (mesmo racional do GraphicComposerService/VideoEditService
 * — MVP): pode virar BullMQ depois sem mudar o contrato do endpoint.
 */
@Injectable()
export class FormatExportService {
  private readonly logger = new Logger(FormatExportService.name);

  constructor(
    @InjectRepository(FormatExport) private readonly repo: Repository<FormatExport>,
    @InjectRepository(Script) private readonly scripts: Repository<Script>,
    private readonly ffmpeg: FfmpegService,
    private readonly mediaAssets: MediaAssetsService,
    private readonly graphicComposer: GraphicComposerService,
  ) {}

  async create(dto: CreateFormatExportDto): Promise<FormatExport> {
    const formats: ExportFormatKind[] = dto.formats?.length ? dto.formats : ([...ALL_FORMATS] as ExportFormatKind[]);
    const results: FormatExportResult[] = [];
    const tempPaths: string[] = [];

    try {
      const videoFormats = formats.filter((f): f is VideoFormat => f !== 'carousel');

      if (videoFormats.length) {
        let sourceVideoPath: string | null = null;
        try {
          const { path } = await this.mediaAssets.downloadToTemp(dto.source_asset_id, dto.tenant_id);
          sourceVideoPath = path;
          tempPaths.push(path);
        } catch (err) {
          this.logger.warn(`Não foi possível baixar a peça de origem: ${(err as Error).message}`);
          for (const format of videoFormats) {
            results.push({ format, status: 'FAILED', error_message: `Falha ao baixar peça de origem: ${(err as Error).message}` });
          }
        }

        if (sourceVideoPath) {
          for (const format of videoFormats) {
            try {
              const croppedPath = await this.ffmpeg.cropToAspectRatio({
                inputPath: sourceVideoPath,
                aspectRatio: ASPECT_RATIO_BY_FORMAT[format],
              });
              tempPaths.push(croppedPath);

              const buffer = await fs.readFile(croppedPath);
              const asset = await this.mediaAssets.uploadAndRegister({
                tenantId: dto.tenant_id,
                buffer,
                contentType: 'video/mp4',
                fileType: 'video/mp4',
                engineSource: 'FORMAT_EXPORT',
                extraMetadata: { source_asset_id: dto.source_asset_id, format },
              });
              results.push({ format, status: 'DONE', output_asset_id: asset.id });
            } catch (err) {
              this.logger.warn(`Export de formato "${format}" falhou: ${(err as Error).message}`);
              results.push({ format, status: 'FAILED', error_message: (err as Error).message });
            }
          }
        }
      }

      if (formats.includes('carousel')) {
        try {
          const composition = await this.exportCarousel(dto);
          results.push({ format: 'carousel', status: 'DONE', output_asset_ids: composition.output_asset_ids });
        } catch (err) {
          this.logger.warn(`Export de formato "carousel" falhou: ${(err as Error).message}`);
          results.push({ format: 'carousel', status: 'FAILED', error_message: (err as Error).message });
        }
      }

      const doneCount = results.filter((r) => r.status === 'DONE').length;
      const overallStatus: FormatExportOverallStatus =
        doneCount === 0 ? 'FAILED' : doneCount === results.length ? 'DONE' : 'PARTIAL';

      const saved = this.repo.create({
        tenant_id: dto.tenant_id,
        source_asset_id: dto.source_asset_id,
        script_id: dto.script_id ?? null,
        requested_formats: formats,
        results,
        status: overallStatus,
      });
      return await this.repo.save(saved);
    } finally {
      await Promise.all(tempPaths.map((p) => fs.rm(p, { force: true }).catch(() => undefined)));
    }
  }

  async findOneOrFail(id: string, tenantId: string): Promise<FormatExport> {
    return this.repo.findOneOrFail({ where: { id, tenant_id: tenantId } });
  }

  async findByTenant(tenantId: string): Promise<FormatExport[]> {
    return this.repo.find({ where: { tenant_id: tenantId }, order: { created_at: 'DESC' } });
  }

  /**
   * Monta o `ComposeGraphicDto` do carrossel a partir do `Script.contract`
   * (hook/roteiro/cta) e delega ao `GraphicComposerService.compose()` já
   * existente — o usuário não digita o texto de novo.
   */
  private async exportCarousel(dto: CreateFormatExportDto) {
    if (!dto.script_id) {
      throw new Error('"script_id" é obrigatório para exportar "carousel" (é dele que vem o hook/roteiro/cta).');
    }
    if (!dto.brand_kit) {
      throw new Error('"brand_kit" é obrigatório para exportar "carousel".');
    }

    const script = await this.scripts.findOne({ where: { id: dto.script_id } });
    if (!script) throw new Error(`Script ${dto.script_id} não encontrado.`);

    const contract = script.contract as unknown as ScriptContract;
    if (!contract?.hook || !contract?.cta) {
      throw new Error(`Script ${dto.script_id} não tem um "contract" válido (hook/cta ausentes).`);
    }

    const slides: GraphicSlideDto[] = [{ title: contract.hook } as GraphicSlideDto];

    const middleSegments = (contract.roteiro ?? [])
      .filter((seg) => seg.segment !== 'hook' && seg.segment !== 'cta' && seg.text)
      .slice(0, MAX_ROTEIRO_SLIDES);
    for (const seg of middleSegments) {
      slides.push({ body: seg.text } as GraphicSlideDto);
    }

    slides.push({ title: contract.cta } as GraphicSlideDto);

    const composeDto: ComposeGraphicDto = {
      tenant_id: dto.tenant_id,
      kind: 'carousel',
      format: '1080x1350',
      slides: slides.slice(0, 10),
      brand_kit: {
        palette: dto.brand_kit.palette,
        font_family: dto.brand_kit.font_family,
        logo_url: dto.brand_kit.logo_url,
      },
    } as ComposeGraphicDto;

    return this.graphicComposer.compose(composeDto);
  }
}
