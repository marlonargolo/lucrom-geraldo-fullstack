import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Tenant } from '../tenants/tenant.entity';

export type UserRole = 'ADMIN' | 'MEMBER';

/**
 * Entidade de usuário para autenticação real (cadastro/login com JWT),
 * complementar ao ApiTokenGuard (token estático por ambiente, usado em
 * fluxos server-to-server).
 */
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Index()
  @Column({ type: 'uuid' })
  tenant_id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255 })
  email: string;

  @Column({ type: 'varchar', length: 255 })
  password_hash: string;

  /**
   * Primeiro usuário de um tenant (criado via auto-cadastro em
   * `AuthService.register`) nasce ADMIN; convites futuros de membros
   * adicionais (fora do escopo desta entrega) nasceriam MEMBER.
   */
  @Column({ type: 'varchar', length: 20, default: 'ADMIN' })
  role: UserRole;

  @Column({ type: 'timestamptz', nullable: true })
  last_login_at: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
