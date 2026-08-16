import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Tenant } from '../../tenants/tenant.entity';

export type VoiceProfileStatus = 'PENDING' | 'READY' | 'FAILED';

/**
 * Tabela `voice_profiles` — Clonagem de Voz (MiniMax, `/v1/voice_clone`).
 *
 * Guarda a referência (`external_voice_id`) para a voz clonada na MiniMax a
 * partir de uma amostra de áudio enviada pelo tenant (`source_asset_id`,
 * aponta pra `media_assets`). Este registro NUNCA guarda o áudio em si —
 * só o ponteiro, seguindo o mesmo padrão de `media_assets` (DB só guarda
 * metadados, binário fica no S3/MinIO ou no provedor externo).
 *
 * Consumida por `AvatarOrchestratorService.generateVideo` para sintetizar a
 * narração (texto → áudio na voz clonada, via `MinimaxClientService`) antes
 * de mandar o áudio pro `KlingClientService` fazer o lip-sync.
 *
 * ATENÇÃO — regra da MiniMax: a voz só fica permanente se for usada em pelo
 * menos uma síntese dentro de 168h da clonagem (ver comentário em
 * `minimax-client.service.ts`). Por isso `last_used_at` existe: permite ao
 * orquestrador saber se precisa reclonar antes de tentar usar uma voz velha.
 */
@Entity('voice_profiles')
export class VoiceProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Index()
  @Column({ type: 'uuid' })
  tenant_id: string;

  @Column({ type: 'varchar', length: 200 })
  name: string;

  /** id da amostra de áudio original em `media_assets` (consentimento/rastreabilidade). */
  @Column({ type: 'uuid', nullable: true })
  source_asset_id: string | null;

  /** `voice_id` escolhido por nós e confirmado pela MiniMax (POST /v1/voice_clone). */
  @Column({ type: 'varchar', length: 100, nullable: true })
  external_voice_id: string | null;

  /** Última vez que esta voz foi usada em `synthesizeSpeech` — usado pra checar a janela de 168h da MiniMax. */
  @Column({ type: 'timestamptz', nullable: true })
  last_used_at: Date | null;

  @Column({ type: 'varchar', length: 20, default: 'PENDING' })
  status: VoiceProfileStatus;

  @Column({ type: 'text', nullable: true })
  error_message: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
