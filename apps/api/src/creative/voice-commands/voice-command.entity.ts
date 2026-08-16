import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Tenant } from '../../tenants/tenant.entity';

/**
 * Tabela `voice_commands` — Lacuna 3: extensão do pipeline WhisperX para
 * comandos de voz diretos do usuário (ex.: gravar um áudio dizendo "gera um
 * roteiro pra reels de farmácia sobre promoção de vitamina D").
 *
 * Reaproveita o MESMO modelo WhisperX já usado pelo AudioCleanService
 * (engines/m8/audio-clean.service.ts) via ReplicateClientService — não é um
 * pipeline de transcrição paralelo, é a mesma infraestrutura aplicada a um
 * novo tipo de entrada (comando falado em vez de narração de vídeo).
 */
@Entity('voice_commands')
export class VoiceCommand {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Index()
  @Column({ type: 'uuid' })
  tenant_id: string;

  @Column({ type: 'text' })
  transcript: string;

  /** Intent estruturado interpretado pelo LLM a partir do transcript. */
  @Column({ type: 'jsonb' })
  intent: Record<string, unknown>;

  /** id do media_asset do áudio original, se foi enviado como upload (auditoria). */
  @Column({ type: 'uuid', nullable: true })
  audio_asset_id: string | null;

  @Column({ type: 'varchar', length: 20, default: 'DONE' })
  status: 'DONE' | 'FAILED';

  @Column({ type: 'text', nullable: true })
  error_message: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
