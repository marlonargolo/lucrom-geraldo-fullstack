import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Tenant } from '../tenants/tenant.entity';

/** Tipo de identidade biométrica autorizada. */
export type ConsentSubjectType = 'face' | 'voice';

/**
 * Status do registro de consentimento, na semântica de compliance pedida na
 * auditoria: todo consentimento persistido nasce como LEGAL_CONSENT_GRANTED
 * (aceite formal registrado) e pode transicionar para LEGAL_CONSENT_REVOKED
 * (espelha `revoked_at`, que continua sendo a fonte de verdade operacional)
 * ou LEGAL_CONSENT_EXPIRED (calculado, não persistido — ver `expires_at`).
 */
export type ConsentStatus = 'LEGAL_CONSENT_GRANTED' | 'LEGAL_CONSENT_REVOKED';

/**
 * Cadastro de vozes/rostos autorizados — requisito de PRODUTO, não apenas
 * jurídico (Seção 12 do Documento Mestre Consolidado). Nenhum motor que use
 * rosto ou voz de pessoa real pode operar sem um registro válido aqui.
 *
 * Não existia no schema SQL original (Blueprint Vol.3 só definia tenants,
 * media_assets e audit_gate_logs) — extensão necessária para cobrir a
 * Seção 12, que o frontend já implementava localmente em IndexedDB.
 */
@Entity('consent_records')
export class ConsentRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Index()
  @Column({ type: 'uuid' })
  tenant_id: string;

  @Column({ type: 'varchar', length: 10 })
  subject_type: ConsentSubjectType;

  /**
   * Status de governança do aceite: 'LEGAL_CONSENT_GRANTED' no momento em
   * que o registro é criado por `ConsentService.create()`.
   */
  @Column({ type: 'varchar', length: 30, default: 'LEGAL_CONSENT_GRANTED' })
  status: ConsentStatus;

  /** Nome/identificação da pessoa cujo rosto/voz está sendo autorizado. */
  @Column({ type: 'varchar', length: 255 })
  subject_name: string;

  /** Referência ao documento de consentimento (contrato) armazenado no S3. */
  @Column({ type: 'varchar', length: 500, nullable: true })
  contract_s3_key: string | null;

  @Column({ type: 'timestamptz' })
  granted_at: Date;

  /** Consentimento pode ser revogado a qualquer momento (LGPD, dados biométricos). */
  @Column({ type: 'timestamptz', nullable: true })
  revoked_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  expires_at: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
