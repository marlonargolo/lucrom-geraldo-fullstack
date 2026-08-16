import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client as MinioClient } from 'minio';
import { Readable, pipeline as streamPipeline } from 'stream';
import { promisify } from 'util';
import { createWriteStream } from 'fs';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { randomUUID } from 'crypto';

const pipelineAsync = promisify(streamPipeline);

const LOCAL_STORAGE_DIR = '/tmp/lucrom-storage';

/**
 * StorageService with automatic filesystem fallback when S3_ACCESS_KEY is not
 * configured. The interface is identical in both modes so the rest of the app
 * doesn't need to know which backend is active.
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private client: MinioClient | null = null;
  private bucket: string;
  private useLocalFs: boolean;

  constructor(private readonly config: ConfigService) {
    const s3 = this.config.get('s3');
    this.bucket = s3.bucket;
    this.useLocalFs = !s3.accessKey;

    if (!this.useLocalFs) {
      this.client = new MinioClient({
        endPoint: s3.endPoint,
        port: s3.port,
        useSSL: s3.useSSL,
        accessKey: s3.accessKey,
        secretKey: s3.secretKey,
      });
    }
  }

  async onModuleInit() {
    if (this.useLocalFs) {
      await fs.mkdir(LOCAL_STORAGE_DIR, { recursive: true });
      this.logger.log(`Storage: usando sistema de arquivos local em ${LOCAL_STORAGE_DIR} (S3_ACCESS_KEY não configurado).`);
      return;
    }

    try {
      const exists = await this.client!.bucketExists(this.bucket);
      if (!exists) {
        await this.client!.makeBucket(this.bucket);
        this.logger.log(`Bucket "${this.bucket}" criado.`);
      }
    } catch (err) {
      this.logger.warn(`Não foi possível verificar/criar o bucket agora: ${(err as Error).message}`);
    }
  }

  /** Faz upload de um Buffer e retorna a s3_key gerada. */
  async putObject(key: string, buffer: Buffer, contentType: string): Promise<{ bucket: string; key: string; size: number }> {
    if (this.useLocalFs) {
      const filePath = path.join(LOCAL_STORAGE_DIR, key.replace(/\//g, '_'));
      await fs.mkdir(path.dirname(filePath), { recursive: true }).catch(() => undefined);
      await fs.writeFile(filePath, buffer);
      return { bucket: this.bucket, key, size: buffer.length };
    }

    await this.client!.putObject(this.bucket, key, buffer, buffer.length, { 'Content-Type': contentType });
    return { bucket: this.bucket, key, size: buffer.length };
  }

  /** Baixa um objeto inteiro para um Buffer. */
  async getObjectBuffer(key: string): Promise<Buffer> {
    if (this.useLocalFs) {
      const filePath = path.join(LOCAL_STORAGE_DIR, key.replace(/\//g, '_'));
      return fs.readFile(filePath);
    }

    const stream: Readable = await this.client!.getObject(this.bucket, key);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk as Buffer);
    }
    return Buffer.concat(chunks);
  }

  /**
   * Streaming direto do S3 para disco, sem carregar o arquivo inteiro na
   * RAM: pipe S3 ReadStream → WriteStream em arquivo temporário → apenas o
   * path é retornado. Evita risco de OOM em vídeos grandes com múltiplos
   * workers simultâneos (diferente de getObjectBuffer(), que carrega o
   * objeto inteiro em memória).
   *
   * @param key   chave S3 do objeto a baixar
   * @param ext   extensão do arquivo temporário (ex.: 'mp4', 'mov')
   * @returns     caminho local do arquivo temporário (responsabilidade do caller de apagar)
   */
  async streamToTemp(key: string, ext: string): Promise<string> {
    const tmpPath = path.join(os.tmpdir(), `lucrom-storage-${randomUUID()}.${ext}`);

    if (this.useLocalFs) {
      // No modo local não há stream real — copia o arquivo direto
      const srcPath = path.join(LOCAL_STORAGE_DIR, key.replace(/\//g, '_'));
      await fs.copyFile(srcPath, tmpPath);
      return tmpPath;
    }

    const readStream: Readable = await this.client!.getObject(this.bucket, key);
    const writeStream = createWriteStream(tmpPath);
    await pipelineAsync(readStream, writeStream);
    return tmpPath;
  }

  async statObject(key: string) {
    if (this.useLocalFs) {
      const filePath = path.join(LOCAL_STORAGE_DIR, key.replace(/\//g, '_'));
      const stat = await fs.stat(filePath);
      return { size: stat.size, lastModified: stat.mtime };
    }
    return this.client!.statObject(this.bucket, key);
  }

  /** URL pré-assinada (7 dias) — em modo local retorna um path simbólico. */
  async presignedGetUrl(key: string, expirySeconds = 60 * 60 * 24 * 7): Promise<string> {
    if (this.useLocalFs) {
      return `file://${LOCAL_STORAGE_DIR}/${key.replace(/\//g, '_')}`;
    }
    return this.client!.presignedGetObject(this.bucket, key, expirySeconds);
  }

  /**
   * Baixa uma URL EXTERNA (ex.: resultado de um provedor de IA — Fal.ai/Replicate)
   * direto para um arquivo temporário local, via streaming (mesmo racional de
   * `streamToTemp`: nunca carrega o arquivo inteiro em memória).
   * Usado por `video-render.worker.ts` antes do pós-processamento com FFmpeg.
   */
  async downloadFromUrlToTemp(url: string, ext: string): Promise<string> {
    const tmpPath = path.join(os.tmpdir(), `lucrom-ai-download-${randomUUID()}.${ext}`);
    const res = await fetch(url);
    if (!res.ok || !res.body) {
      throw new Error(`Falha ao baixar ${url} (HTTP ${res.status}).`);
    }
    const writeStream = createWriteStream(tmpPath);
    await pipelineAsync(Readable.fromWeb(res.body as any), writeStream);
    return tmpPath;
  }

  get bucketName() {
    return this.bucket;
  }
}
