import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Tenant } from '../tenants/tenant.entity';

/**
 * Motor que originou este asset. M8 = Vídeo & Tratamento Audiovisual (motor original).
 *
 * Adições (Lacunas 2-4, preservando 'M8' e 'UPLOAD' inalterados):
 *   GRAPHIC_COMPOSER — slides de carrossel/arte estática (GraphicComposerService).
 *   VOICE_COMMAND    — áudio original de um comando de voz (VoiceCommandService).
 *   MOTION_GRAPHICS  — vídeo de saída com overlay/lower-third/transição (MotionGraphicsService).
 *
 * Adições (Edição pós-geração + Export multi-formato, preservando todos os
 * valores acima inalterados):
 *   VIDEO_EDIT     — vídeo cortado/legendado a partir de uma peça já gerada (VideoEditService).
 *   FORMAT_EXPORT  — variante de formato (Reels/Story/Feed/Carrossel) gerada a partir
 *                    de uma peça já gerada (FormatExportService).
 *
 * Adição (Avatar Engine — avatar real + voz clonada + lip-sync, Kling +
 * MiniMax, preservando todos os valores acima inalterados):
 *   AVATAR_ENGINE  — narração sintetizada (MiniMax) e vídeo final com lip-sync
 *                    (Kling) gerados pelo AvatarOrchestratorService.
 */
export type EngineSource =
  | 'M8'
  | 'UPLOAD'
  | 'GRAPHIC_COMPOSER'
  | 'VOICE_COMMAND'
  | 'MOTION_GRAPHICS'
  | 'VIDEO_EDIT'
  | 'FORMAT_EXPORT'
  | 'AVATAR_ENGINE';

/**
 * Tabela `media_assets` — ponteiro para o binário real no S3/MinIO.
 * Schema idêntico ao Documento Mestre 02 §2.2 / Blueprint Executivo Volume 3 §1.2.
 */
@Entity('media_assets')
export class MediaAsset {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Index()
  @Column({ type: 'uuid' })
  tenant_id: string;

  @Column({ type: 'varchar', length: 20 })
  engine_source: EngineSource;

  @Column({ type: 'varchar', length: 50 })
  file_type: string;

  @Column({ type: 'varchar', length: 100 })
  s3_bucket: string;

  @Column({ type: 'varchar', length: 500 })
  s3_key: string;

  @Column({ type: 'bigint' })
  file_size_bytes: number;

  @Column({ type: 'jsonb', default: {} })
  metadata: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
