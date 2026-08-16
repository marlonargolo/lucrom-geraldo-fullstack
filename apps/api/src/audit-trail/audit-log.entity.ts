import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Tabela `audit_logs` — trilha de auditoria de GOVERNANÇA: quem fez qual
 * ação de escrita (POST/PUT/PATCH/DELETE), quando e em qual rota.
 *
 * Não confundir com `audit_gate_logs` (src/audit/audit-gate-log.entity.ts),
 * que audita a QUALIDADE de uma peça nos 3 portões do M10 — propósito
 * diferente, tabela diferente, endpoint diferente (`/api/v1/audit-gate-logs`
 * continua intocado; este módulo expõe `/api/v1/audit`).
 */
@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  tenant_id: string | null;

  /**
   * Identificação do ator que executou a ação. Vem do JWT opcional em
   * `X-Actor-Token` (subject/nome), ou 'api_token' quando só o ApiTokenGuard
   * estático foi usado (ver AuthAuditMiddleware para o porquê disso ser MVP).
   */
  @Column({ type: 'varchar', length: 255, default: 'api_token' })
  actor: string;

  @Column({ type: 'varchar', length: 10 })
  method: string;

  @Column({ type: 'varchar', length: 500 })
  route: string;

  @Column({ type: 'int' })
  status_code: number;

  @Column({ type: 'varchar', length: 64, nullable: true })
  ip_address: string | null;

  /** Corpo da requisição sem campos sensíveis (ver redactBody no middleware). */
  @Column({ type: 'jsonb', nullable: true })
  request_body: Record<string, unknown> | null;

  @Column({ type: 'int' })
  duration_ms: number;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
