import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';
import { MediaAsset, EngineSource } from './media-asset.entity';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class MediaAssetsService {
  constructor(
    @InjectRepository(MediaAsset) private readonly repo: Repository<MediaAsset>,
    private readonly storage: StorageService,
  ) {}

  /** Sobe um binário para o S3/MinIO e registra o ponteiro no Postgres (padrão do doc mestre: DB só guarda metadados). */
  async uploadAndRegister(params: {
    tenantId: string;
    buffer: Buffer;
    contentType: string;
    fileType: string;
    engineSource: EngineSource;
    extraMetadata?: Record<string, unknown>;
  }): Promise<MediaAsset> {
    const key = `${params.tenantId}/${params.engineSource.toLowerCase()}/${uuid()}`;
    const { bucket, size } = await this.storage.putObject(key, params.buffer, params.contentType);

    const asset = this.repo.create({
      tenant_id: params.tenantId,
      engine_source: params.engineSource,
      file_type: params.fileType,
      s3_bucket: bucket,
      s3_key: key,
      file_size_bytes: size,
      metadata: params.extraMetadata ?? {},
    });
    return this.repo.save(asset);
  }

  async findOneOrFail(id: string, tenantId: string): Promise<MediaAsset> {
    const asset = await this.repo.findOne({ where: { id, tenant_id: tenantId } });
    if (!asset) throw new NotFoundException(`Media asset ${id} não encontrado.`);
    return asset;
  }

  async findByTenant(tenantId: string) {
    return this.repo.find({ where: { tenant_id: tenantId }, order: { created_at: 'DESC' } });
  }

  async presignedUrlFor(asset: MediaAsset): Promise<string> {
    return this.storage.presignedGetUrl(asset.s3_key);
  }

  /**
   * Baixa o binário de um media asset já registrado para um arquivo temporário
   * local (streaming, via `StorageService.streamToTemp` — nunca carrega o
   * arquivo inteiro em memória). Usado por VideoEditService e
   * FormatExportService, que precisam de um caminho local para o ffmpeg
   * processar uma peça já gerada anteriormente.
   *
   * A extensão do arquivo temporário é inferida de `file_type` (mime type)
   * quando possível, com fallback para 'mp4' (caso mais comum aqui: vídeo).
   *
   * @param assetId  id do media_asset a baixar
   * @returns        caminho local do arquivo temporário (responsabilidade do
   *                  caller de apagar após o uso, como nos demais métodos do FfmpegService)
   */
  async downloadToTemp(assetId: string, tenantId: string): Promise<{ path: string; asset: MediaAsset }> {
    const asset = await this.findOneOrFail(assetId, tenantId);
    const ext = extensionFromMimeType(asset.file_type);
    const path = await this.storage.streamToTemp(asset.s3_key, ext);
    return { path, asset };
  }
}

/** Deriva uma extensão de arquivo a partir de um mime type, com fallback para 'mp4'. */
function extensionFromMimeType(mimeType: string): string {
  const map: Record<string, string> = {
    'video/mp4': 'mp4',
    'video/quicktime': 'mov',
    'video/webm': 'webm',
    'image/png': 'png',
    'image/jpeg': 'jpg',
  };
  return map[mimeType] ?? 'mp4';
}
