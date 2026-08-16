import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from '../../../tenants/tenant.entity';
import { MediaAsset } from '../../../media-assets/media-asset.entity';
import { MediaAssetsService } from '../../../media-assets/media-assets.service';
import { StorageService } from '../../../storage/storage.service';
import { FfmpegService } from '../ffmpeg.service';
import { OverlayImageDto } from './dto/overlay-image.dto';
import { LowerThirdDto } from './dto/lower-third.dto';
import { TransitionDto } from './dto/transition.dto';

/**
 * Lacuna 4 — Orquestra os primitivos de Motion Graphics adicionados ao
 * FfmpegService (overlayImage, renderLowerThird, applyTransition) sobre
 * `media_assets` já existentes (upload direto ou saída de um render M8).
 *
 * Processamento SÍNCRONO (MVP), assim como o GraphicComposerService: cada
 * operação roda um único passe de FFmpeg. Para vídeos muito longos, isto pode
 * virar um job na fila BullMQ (mesmo padrão do M8Service/M8ProcessorCore) sem
 * mudar o contrato dos endpoints — só o "202 Accepted + polling" no lugar do
 * "200 OK" imediato.
 */
@Injectable()
export class MotionGraphicsService {
  private readonly logger = new Logger(MotionGraphicsService.name);

  constructor(
    @InjectRepository(Tenant) private readonly tenants: Repository<Tenant>,
    @InjectRepository(MediaAsset) private readonly assets: Repository<MediaAsset>,
    private readonly storage: StorageService,
    private readonly mediaAssets: MediaAssetsService,
    private readonly ffmpeg: FfmpegService,
  ) {}

  async overlayImage(dto: OverlayImageDto): Promise<MediaAsset> {
    await this.assertTenant(dto.tenant_id);
    const videoAsset = await this.assetByKey(dto.tenant_id, dto.source_video_key);
    const imageAsset = await this.assetByKey(dto.tenant_id, dto.overlay_image_key);

    const videoPath = await this.storage.streamToTemp(videoAsset.s3_key, this.extOf(videoAsset.file_type, 'mp4'));
    const imagePath = await this.storage.streamToTemp(imageAsset.s3_key, this.extOf(imageAsset.file_type, 'png'));

    try {
      const outputPath = await this.ffmpeg.overlayImage({
        inputPath: videoPath,
        overlayImagePath: imagePath,
        position: dto.position,
        opacity: dto.opacity,
        scaleWidth: dto.scale_width,
        startTime: dto.start_time,
        endTime: dto.end_time,
      });
      return this.persistOutput(dto.tenant_id, outputPath, { operation: 'overlay_image', source_asset_id: videoAsset.id });
    } finally {
      await this.ffmpeg.readAndCleanup(videoPath).catch(() => undefined);
      await this.ffmpeg.readAndCleanup(imagePath).catch(() => undefined);
    }
  }

  async renderLowerThird(dto: LowerThirdDto): Promise<MediaAsset> {
    await this.assertTenant(dto.tenant_id);
    const videoAsset = await this.assetByKey(dto.tenant_id, dto.source_video_key);

    if (dto.end_time <= dto.start_time) {
      throw new BadRequestException('"end_time" deve ser maior que "start_time".');
    }

    const videoPath = await this.storage.streamToTemp(videoAsset.s3_key, this.extOf(videoAsset.file_type, 'mp4'));

    try {
      const outputPath = await this.ffmpeg.renderLowerThird({
        inputPath: videoPath,
        title: dto.title,
        subtitle: dto.subtitle,
        startTime: dto.start_time,
        endTime: dto.end_time,
        accentColor: dto.accent_color,
        textColor: dto.text_color,
      });
      return this.persistOutput(dto.tenant_id, outputPath, { operation: 'lower_third', source_asset_id: videoAsset.id });
    } finally {
      await this.ffmpeg.readAndCleanup(videoPath).catch(() => undefined);
    }
  }

  async applyTransition(dto: TransitionDto): Promise<MediaAsset> {
    await this.assertTenant(dto.tenant_id);
    const firstAsset = await this.assetByKey(dto.tenant_id, dto.first_clip_key);
    const secondAsset = await this.assetByKey(dto.tenant_id, dto.second_clip_key);

    const firstPath = await this.storage.streamToTemp(firstAsset.s3_key, this.extOf(firstAsset.file_type, 'mp4'));
    const secondPath = await this.storage.streamToTemp(secondAsset.s3_key, this.extOf(secondAsset.file_type, 'mp4'));

    try {
      const outputPath = await this.ffmpeg.applyTransition({
        firstClipPath: firstPath,
        secondClipPath: secondPath,
        transition: dto.transition,
        durationSeconds: dto.duration_seconds,
      });
      return this.persistOutput(dto.tenant_id, outputPath, {
        operation: 'transition',
        transition: dto.transition ?? 'fade',
        source_asset_ids: [firstAsset.id, secondAsset.id],
      });
    } finally {
      await this.ffmpeg.readAndCleanup(firstPath).catch(() => undefined);
      await this.ffmpeg.readAndCleanup(secondPath).catch(() => undefined);
    }
  }

  private async assertTenant(tenantId: string) {
    const tenant = await this.tenants.findOne({ where: { id: tenantId } });
    if (!tenant) throw new BadRequestException(`Tenant ${tenantId} não encontrado.`);
  }

  private async assetByKey(tenantId: string, s3Key: string): Promise<MediaAsset> {
    const asset = await this.assets.findOne({ where: { tenant_id: tenantId, s3_key: s3Key } });
    if (!asset) {
      throw new BadRequestException(
        `A chave "${s3Key}" não corresponde a nenhum asset deste tenant. Faça upload primeiro em POST /api/v1/media-assets/upload.`,
      );
    }
    return asset;
  }

  private extOf(mimeType: string, fallback: string): string {
    if (mimeType.includes('mp4')) return 'mp4';
    if (mimeType.includes('quicktime') || mimeType.includes('mov')) return 'mov';
    if (mimeType.includes('png')) return 'png';
    if (mimeType.includes('jpeg') || mimeType.includes('jpg')) return 'jpg';
    return fallback;
  }

  private async persistOutput(tenantId: string, outputPath: string, metadata: Record<string, unknown>): Promise<MediaAsset> {
    const buffer = await this.ffmpeg.readAndCleanup(outputPath);
    return this.mediaAssets.uploadAndRegister({
      tenantId,
      buffer,
      contentType: 'video/mp4',
      fileType: 'video/mp4',
      engineSource: 'MOTION_GRAPHICS',
      extraMetadata: metadata,
    });
  }
}
