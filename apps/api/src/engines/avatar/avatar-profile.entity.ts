import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Tenant } from '../../tenants/tenant.entity';

export type AvatarProfileStatus = 'PENDING' | 'READY' | 'FAILED';

/**
 * Tabela `avatar_profiles` — Avatar (Kling `face-detect` + `advanced-lip-sync`).
 *
 * DIFERENÇA IMPORTANTE em relação ao HeyGen (avaliado e descartado — ver
 * conversa que precedeu esta implementação): o Kling não tem o conceito de
 * "avatar" pré-cadastrado e reutilizável (tipo o `talking_photo_id` do
 * HeyGen). Em vez disso, cada vídeo de origem passa por
 * `KlingClientService.identifyFace()` UMA VEZ, e o resultado
 * (`kling_session_id` + `kling_face_id`) é o que fica reutilizável — pode
 * ser referenciado em várias gerações de lip-sync depois, desde que a
 * sessão do Kling ainda esteja válida (por isso `status` pode voltar pra
 * PENDING se a sessão expirar e precisar ser refeita).
 *
 * `source_asset_id` aponta pra um `media_asset` de VÍDEO (não foto — o
 * Kling precisa de um vídeo real da pessoa, com o rosto visível, pra
 * detectar o rosto e depois aplicar o lip-sync em cima dele).
 *
 * `consent_record_id` é OBRIGATÓRIO, mesma regra do `ConsentModule` já
 * existente no projeto (subject_type='face').
 */
@Entity('avatar_profiles')
export class AvatarProfile {
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

  /** id do vídeo-fonte original em `media_assets` (o vídeo real da pessoa, com o rosto visível). */
  @Column({ type: 'uuid' })
  source_asset_id: string;

  /** id do registro de consentimento (`consent_records`, subject_type='face') que autoriza o uso desta imagem/vídeo. */
  @Column({ type: 'uuid' })
  consent_record_id: string;

  /** Retornado por KlingClientService.identifyFace() — agrupa o(s) rosto(s) detectado(s) neste vídeo-fonte. */
  @Column({ type: 'varchar', length: 100, nullable: true })
  kling_session_id: string | null;

  /** Id do rosto específico dentro da sessão acima — é isso que o advanced-lip-sync usa em `face_choose`. */
  @Column({ type: 'varchar', length: 100, nullable: true })
  kling_face_id: string | null;

  @Column({ type: 'varchar', length: 20, default: 'PENDING' })
  status: AvatarProfileStatus;

  @Column({ type: 'text', nullable: true })
  error_message: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
