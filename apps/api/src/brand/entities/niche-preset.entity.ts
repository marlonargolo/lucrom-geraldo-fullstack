import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * FASE 2 — catálogo de nichos como dado no banco (não existia em nenhum dos
 * pacotes recebidos; único artefato relacionado era `NicheType` hardcoded em
 * `engines/m8/niche-preset.service.ts`, usado só internamente pelo pipeline
 * M8 de geração de fundo). Esta entidade é o catálogo CONSULTÁVEL via API
 * (`GET /brand/niche-presets`) pro frontend listar opções sem duplicar essa
 * lista — `key` usa as MESMAS 4 chaves do `NicheType` de propósito, pra
 * manter os dois lados em sincronia (seed inicial na migration).
 */
@Entity('niche_presets')
export class NichePreset {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 50 })
  key: string; // 'marcenaria' | 'farmacia' | 'mercado' | 'escritorio' (ou novo, cadastrado via POST)

  @Column({ type: 'varchar', length: 100 })
  label: string; // nome de exibição, ex.: "Marcenaria"

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
