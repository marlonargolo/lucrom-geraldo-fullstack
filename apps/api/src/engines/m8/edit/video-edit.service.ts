import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs/promises';
import { VideoEdit } from './video-edit.entity';
import { CreateVideoEditDto } from './dto/create-video-edit.dto';
import { FfmpegService } from '../ffmpeg.service';
import { MediaAssetsService } from '../../../media-assets/media-assets.service';

/**
 * Edição pós-geração (engines/m8/edit) — conecta o que já existia
 * (`FfmpegService.trim()`/`renderLowerThird()`, `MediaAssetsService`) numa
 * operação de produto: corta um vídeo já gerado e, opcionalmente, aplica
 * legenda, devolvendo um NOVO media asset (o original nunca é sobrescrito).
 *
 * Processamento síncrono (mesmo racional do GraphicComposerService — MVP):
 * corte + legenda de um clipe de alguns segundos/minutos leva tipicamente
 * poucos segundos de ffmpeg, bem abaixo de um timeout HTTP comum. Se isso
 * mudar (vídeos muito longos, alto volume), vira um job BullMQ como o M8
 * (ver engines/m8/m8.service.ts) sem alterar o contrato do endpoint.
 */
@Injectable()
export class VideoEditService {
  private readonly logger = new Logger(VideoEditService.name);

  constructor(
    @InjectRepository(VideoEdit) private readonly repo: Repository<VideoEdit>,
    private readonly ffmpeg: FfmpegService,
    private readonly mediaAssets: MediaAssetsService,
  ) {}

  async create(dto: CreateVideoEditDto): Promise<VideoEdit> {
    if (dto.end_time_seconds <= dto.start_time_seconds) {
      throw new BadRequestException('"end_time_seconds" precisa ser maior que "start_time_seconds".');
    }

    const tempPaths: string[] = [];
    try {
      const { path: sourcePath } = await this.mediaAssets.downloadToTemp(dto.source_asset_id, dto.tenant_id);
      tempPaths.push(sourcePath);

      const trimmedPath = await this.ffmpeg.trim({
        inputPath: sourcePath,
        startTime: dto.start_time_seconds,
        endTime: dto.end_time_seconds,
      });
      tempPaths.push(trimmedPath);

      let finalPath = trimmedPath;
      if (dto.caption) {
        const trimmedDuration = dto.end_time_seconds - dto.start_time_seconds;
        const captionedPath = await this.ffmpeg.renderLowerThird({
          inputPath: trimmedPath,
          title: dto.caption.title,
          subtitle: dto.caption.subtitle,
          startTime: dto.caption.start_time_seconds ?? 0,
          endTime: dto.caption.end_time_seconds ?? trimmedDuration,
          accentColor: dto.caption.accent_color,
          textColor: dto.caption.text_color,
        });
        tempPaths.push(captionedPath);
        finalPath = captionedPath;
      }

      const buffer = await fs.readFile(finalPath);
      const outputAsset = await this.mediaAssets.uploadAndRegister({
        tenantId: dto.tenant_id,
        buffer,
        contentType: 'video/mp4',
        fileType: 'video/mp4',
        engineSource: 'VIDEO_EDIT',
        extraMetadata: {
          source_asset_id: dto.source_asset_id,
          start_time_seconds: dto.start_time_seconds,
          end_time_seconds: dto.end_time_seconds,
          caption_applied: Boolean(dto.caption),
        },
      });

      const saved = this.repo.create({
        tenant_id: dto.tenant_id,
        source_asset_id: dto.source_asset_id,
        output_asset_id: outputAsset.id,
        start_time_seconds: dto.start_time_seconds,
        end_time_seconds: dto.end_time_seconds,
        caption: dto.caption ? { ...dto.caption } : null,
        status: 'DONE',
      });
      return await this.repo.save(saved);
    } catch (err) {
      this.logger.error(`Falha ao editar vídeo: ${(err as Error).message}`, (err as Error).stack);
      const failed = this.repo.create({
        tenant_id: dto.tenant_id,
        source_asset_id: dto.source_asset_id,
        output_asset_id: null,
        start_time_seconds: dto.start_time_seconds,
        end_time_seconds: dto.end_time_seconds,
        caption: dto.caption ? { ...dto.caption } : null,
        status: 'FAILED',
        error_message: (err as Error).message,
      });
      await this.repo.save(failed);
      throw new BadRequestException(`Falha ao editar vídeo: ${(err as Error).message}`);
    } finally {
      await Promise.all(tempPaths.map((p) => fs.rm(p, { force: true }).catch(() => undefined)));
    }
  }

  async findOneOrFail(id: string, tenantId: string): Promise<VideoEdit> {
    const edit = await this.repo.findOne({ where: { id, tenant_id: tenantId } });
    if (!edit) throw new NotFoundException(`Video edit ${id} não encontrado.`);
    return edit;
  }

  async findByTenant(tenantId: string): Promise<VideoEdit[]> {
    return this.repo.find({ where: { tenant_id: tenantId }, order: { created_at: 'DESC' } });
  }
}
