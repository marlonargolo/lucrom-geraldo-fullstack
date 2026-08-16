import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Tenant } from '../../tenants/tenant.entity';
import { NichePreset } from './niche-preset.entity';

/**
 * FASE 2 — versão persistida do `BrandKitDto` já usado hoje por
 * `GraphicComposerService` (ver `creative/graphic-composer/dto/compose-graphic.dto.ts`),
 * que hoje só existe como payload efêmero enviado a cada chamada de
 * `POST /creative/graphic-composer`. Esta entidade permite ao tenant salvar
 * um kit nomeado e reutilizá-lo, em vez de reenviar paleta/fonte/logo toda
 * vez — os nomes de campo (`palette`, `font_family`, `logo_url`) são
 * mantidos IDÊNTICOS aos do `BrandKitDto` de propósito, pra
 * `BrandKitsService.toComposerDto()` poder devolver o formato exato que o
 * GraphicComposer já espera, sem tradução.
 */
@Entity('brand_kits')
export class BrandKit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Index()
  @Column({ type: 'uuid' })
  tenant_id: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  /** [0]=primária, [1]=secundária, [2]=texto — mesma convenção do template (slide-template.ts). */
  @Column({ type: 'jsonb' })
  palette: string[];

  @Column({ type: 'varchar', length: 100, nullable: true })
  font_family: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  logo_url: string | null;

  @ManyToOne(() => NichePreset, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'niche_preset_id' })
  niche_preset: NichePreset | null;

  @Column({ type: 'uuid', nullable: true })
  niche_preset_id: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
