import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import puppeteer, { Browser } from 'puppeteer';
import { Tenant } from '../../tenants/tenant.entity';
import { StorageService } from '../../storage/storage.service';
import { MediaAssetsService } from '../../media-assets/media-assets.service';
import { GraphicComposition } from './graphic-composition.entity';
import { ComposeGraphicDto } from './dto/compose-graphic.dto';
import { UpdateGraphicLayersDto } from './dto/update-graphic-layers.dto';
import { buildSlideHtml, buildDefaultLayers, renderSlideFromLayers } from './templates/slide-template';
import { GraphicSlideLayers, GraphicCompositionSnapshot } from './graphic-layer.types';

/**
 * Lacuna 2 — Motor de composição gráfica (carrosséis e artes estáticas).
 *
 * IMPLEMENTAÇÃO: Puppeteer (Chromium headless) renderiza HTML/CSS montado
 * pelo template (tipografia limpa + paleta do brand kit) em 1080x1350
 * (formato feed/carrossel) ou 1080x1920 (formato story/reels-cover), tira
 * um screenshot PNG por slide e salva cada um como `media_asset` via
 * MediaAssetsService (engine_source = 'GRAPHIC_COMPOSER').
 *
 * Processamento síncrono (MVP): cada slide leva ~200-600ms para renderizar,
 * então mesmo um carrossel de 10 slides fica bem abaixo de um timeout HTTP
 * comum. Se o volume crescer, isto pode virar um BullMQ job como o M8
 * (ver engines/m8/m8.service.ts) sem mudar o contrato do endpoint.
 */
@Injectable()
export class GraphicComposerService {
  private readonly logger = new Logger(GraphicComposerService.name);
  private readonly executablePath?: string;

  constructor(
    @InjectRepository(GraphicComposition) private readonly compositions: Repository<GraphicComposition>,
    @InjectRepository(Tenant) private readonly tenants: Repository<Tenant>,
    private readonly storage: StorageService,
    private readonly mediaAssets: MediaAssetsService,
    private readonly config: ConfigService,
  ) {
    this.executablePath = this.config.get<string>('puppeteer.executablePath') || undefined;
  }

  async compose(dto: ComposeGraphicDto): Promise<GraphicComposition> {
    const tenant = await this.tenants.findOne({ where: { id: dto.tenant_id } });
    if (!tenant) throw new BadRequestException(`Tenant ${dto.tenant_id} não encontrado.`);

    if (dto.kind === 'static_art' && dto.slides.length !== 1) {
      throw new BadRequestException('kind="static_art" aceita exatamente 1 item em "slides".');
    }

    const [width, height] = dto.format.split('x').map(Number);
    let browser: Browser | null = null;
    const outputAssetIds: string[] = [];
    const slidesLayers: GraphicSlideLayers[] = [];

    try {
      browser = await this.launchBrowser();

      for (let i = 0; i < dto.slides.length; i++) {
        const slide = dto.slides[i];
        const html = buildSlideHtml({
          width,
          height,
          title: slide.title,
          body: slide.body,
          footer: slide.footer,
          palette: dto.brand_kit.palette,
          fontFamily: dto.brand_kit.font_family,
          logoUrl: dto.brand_kit.logo_url,
          slideIndex: dto.kind === 'carousel' ? i : undefined,
          slideTotal: dto.kind === 'carousel' ? dto.slides.length : undefined,
        });

        const pngBuffer = await this.renderPng(browser, html, width, height);

        const asset = await this.mediaAssets.uploadAndRegister({
          tenantId: dto.tenant_id,
          buffer: pngBuffer,
          contentType: 'image/png',
          fileType: 'image/png',
          engineSource: 'GRAPHIC_COMPOSER',
          extraMetadata: {
            kind: dto.kind,
            format: dto.format,
            slide_index: i,
            slide_total: dto.slides.length,
          },
        });
        outputAssetIds.push(asset.id);

        // Módulo Ajuste Rápido Humano — grava o mesmo slide também como
        // camadas editáveis (mesmos valores, forma estruturada), pra que
        // updateLayers() nunca precise chamar a IA de novo pra um ajuste
        // determinístico (fonte/cor/posição/troca de ativo/visibilidade).
        slidesLayers.push({
          slide_index: i,
          elements: buildDefaultLayers({
            title: slide.title,
            body: slide.body,
            footer: slide.footer,
            palette: dto.brand_kit.palette,
            fontFamily: dto.brand_kit.font_family,
            logoUrl: dto.brand_kit.logo_url,
          }),
        });
      }
    } catch (err) {
      const failed = this.compositions.create({
        tenant_id: dto.tenant_id,
        kind: dto.kind,
        format: dto.format,
        output_asset_ids: outputAssetIds,
        // Cast necessário: BrandKitDto (classe validada, sem index signature)
        // não é estruturalmente atribuível a Record<string, unknown> pro
        // DeepPartial do TypeORM, mesmo sendo compatível em runtime (é só
        // um objeto JSON). A coluna `jsonb` da entidade já está tipada
        // corretamente.
        brand_kit_snapshot: dto.brand_kit as unknown as Record<string, unknown>,
        status: 'FAILED',
        error_message: (err as Error).message,
      });
      await this.compositions.save(failed);
      throw new BadRequestException(`Falha ao compor peça gráfica: ${(err as Error).message}`);
    } finally {
      if (browser) await browser.close().catch(() => undefined);
    }

    const saved = this.compositions.create({
      tenant_id: dto.tenant_id,
      kind: dto.kind,
      format: dto.format,
      output_asset_ids: outputAssetIds,
      brand_kit_snapshot: dto.brand_kit as unknown as Record<string, unknown>,
      status: 'DONE',
      layers: slidesLayers,
      version: 1,
      history: [],
    });
    return this.compositions.save(saved);
  }

  findOneOrFail(id: string, tenantId: string) {
    return this.compositions.findOneOrFail({ where: { id, tenant_id: tenantId } });
  }

  findByTenant(tenantId: string) {
    return this.compositions.find({ where: { tenant_id: tenantId }, order: { created_at: 'DESC' } });
  }

  // ─── Módulo Ajuste Rápido Humano ─────────────────────────────────────────
  //
  // Edição pós-geração 100% determinística: NUNCA chama Kling/MiniMax/
  // Replicate/nenhum provedor de IA. Só mescla o patch do usuário nas
  // `layers` já existentes e manda o Puppeteer renderizar de novo — mesmo
  // motor de composição de `compose()`, sem custo de inferência.
  //
  // `dto.updates` referencia camadas por `slide_index` + `layer_id`; camadas
  // não citadas em `updates` saem intactas na nova versão.
  async updateLayers(id: string, tenantId: string, dto: UpdateGraphicLayersDto): Promise<GraphicComposition> {
    const existing = await this.findOneOrFail(id, tenantId);

    if (!existing.layers || existing.layers.length === 0) {
      throw new BadRequestException(
        `Composição ${id} não tem camadas editáveis — foi criada antes do módulo Ajuste Rápido. ` +
          'Gere uma nova peça pra poder editá-la deterministicamente.',
      );
    }
    if (existing.status !== 'DONE') {
      throw new BadRequestException(`Composição ${id} está com status '${existing.status}' — só é possível ajustar peças concluídas.`);
    }

    // snapshot da versão atual ANTES de aplicar o patch — vai pro histórico.
    const snapshot: GraphicCompositionSnapshot = {
      version: existing.version,
      layers: existing.layers,
      output_asset_ids: existing.output_asset_ids,
      source: 'human',
      note: dto.note,
      created_at: new Date().toISOString(),
    };

    // merge raso e determinístico: content + style são sobrescritos campo a
    // campo (não substituídos por inteiro), então um ajuste de cor não some
    // com um ajuste de fonte feito antes na mesma camada.
    const nextLayers: GraphicSlideLayers[] = existing.layers.map((slide) => {
      const slideUpdates = dto.updates.filter((u) => u.slide_index === slide.slide_index);
      if (slideUpdates.length === 0) return slide;
      return {
        slide_index: slide.slide_index,
        elements: slide.elements.map((layer) => {
          const patch = slideUpdates.find((u) => u.layer_id === layer.id);
          if (!patch) return layer;
          return {
            ...layer,
            content: patch.content ?? layer.content,
            style: { ...layer.style, ...patch.style },
          };
        }),
      };
    });

    const [width, height] = existing.format.split('x').map(Number);
    const fontFamily = (existing.brand_kit_snapshot as { font_family?: string } | null)?.font_family;
    const newOutputAssetIds: string[] = [];

    let browser: Browser | null = null;
    try {
      browser = await this.launchBrowser();
      for (const slide of nextLayers) {
        const html = renderSlideFromLayers({
          width,
          height,
          layers: slide.elements,
          fontFamily,
          slideIndex: existing.kind === 'carousel' ? slide.slide_index : undefined,
          slideTotal: existing.kind === 'carousel' ? nextLayers.length : undefined,
        });
        const pngBuffer = await this.renderPng(browser, html, width, height);
        const asset = await this.mediaAssets.uploadAndRegister({
          tenantId,
          buffer: pngBuffer,
          contentType: 'image/png',
          fileType: 'image/png',
          engineSource: 'GRAPHIC_COMPOSER',
          extraMetadata: {
            kind: existing.kind,
            format: existing.format,
            slide_index: slide.slide_index,
            slide_total: nextLayers.length,
            edited_from: existing.id,
            edit_version: existing.version + 1,
          },
        });
        newOutputAssetIds.push(asset.id);
      }
    } catch (err) {
      this.logger.error(`Falha ao re-renderizar composição ${id} após ajuste rápido: ${(err as Error).message}`);
      throw new BadRequestException(`Falha ao aplicar ajuste: ${(err as Error).message}`);
    } finally {
      if (browser) await browser.close().catch(() => undefined);
    }

    existing.layers = nextLayers;
    existing.output_asset_ids = newOutputAssetIds;
    existing.version = existing.version + 1;
    existing.history = [snapshot, ...(existing.history ?? [])];
    return this.compositions.save(existing);
  }

  /**
   * Restaura uma versão anterior do histórico — sem re-renderizar (os
   * `output_asset_ids` daquela versão já existem no storage), então é uma
   * operação instantânea. A versão restaurada vira a atual; a versão de onde
   * o usuário estava vai pro topo do histórico (não se perde nada, dá pra
   * "refazer" navegando o histórico de novo).
   */
  async restoreVersion(id: string, tenantId: string, targetVersion: number): Promise<GraphicComposition> {
    const existing = await this.findOneOrFail(id, tenantId);
    const target = existing.history.find((h) => h.version === targetVersion);
    if (!target) throw new BadRequestException(`Versão ${targetVersion} não encontrada no histórico da composição ${id}.`);

    const currentSnapshot: GraphicCompositionSnapshot = {
      version: existing.version,
      layers: existing.layers ?? [],
      output_asset_ids: existing.output_asset_ids,
      source: 'human',
      note: `Substituída ao restaurar v${targetVersion}`,
      created_at: new Date().toISOString(),
    };

    existing.layers = target.layers;
    existing.output_asset_ids = target.output_asset_ids;
    existing.version = existing.version + 1; // restaurar também é uma nova versão — histórico nunca reescreve o passado
    existing.history = [currentSnapshot, ...existing.history.filter((h) => h.version !== targetVersion)];
    return this.compositions.save(existing);
  }

  private async launchBrowser(): Promise<Browser> {
    try {
      return await puppeteer.launch({
        headless: true,
        executablePath: this.executablePath,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      });
    } catch (err) {
      throw new Error(
        `Não foi possível iniciar o Chromium do Puppeteer (${(err as Error).message}). ` +
          'Verifique se o Chromium está instalado no ambiente (ou defina PUPPETEER_EXECUTABLE_PATH).',
      );
    }
  }

  private async renderPng(browser: Browser, html: string, width: number, height: number): Promise<Buffer> {
    const page = await browser.newPage();
    try {
      await page.setViewport({ width, height, deviceScaleFactor: 1 });
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const screenshot = await page.screenshot({ type: 'png' });
      return Buffer.from(screenshot);
    } finally {
      await page.close().catch(() => undefined);
    }
  }
}
