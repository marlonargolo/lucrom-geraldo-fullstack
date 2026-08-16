import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateBrandKitDto } from './dto/create-brand-kit.dto';
import { BrandKit } from './entities/brand-kit.entity';

@Injectable()
export class BrandKitsService {
  constructor(@InjectRepository(BrandKit) private readonly repo: Repository<BrandKit>) {}

  create(dto: CreateBrandKitDto) {
    const kit = this.repo.create({
      tenant_id: dto.tenant_id,
      name: dto.name,
      palette: dto.palette,
      font_family: dto.font_family ?? null,
      logo_url: dto.logo_url ?? null,
      niche_preset_id: dto.niche_preset_id ?? null,
    });
    return this.repo.save(kit);
  }

  findByTenant(tenantId: string) {
    return this.repo.find({ where: { tenant_id: tenantId }, order: { created_at: 'DESC' } });
  }

  async findOneOrFail(id: string, tenantId: string): Promise<BrandKit> {
    const kit = await this.repo.findOne({ where: { id, tenant_id: tenantId } });
    if (!kit) throw new NotFoundException(`Brand kit ${id} não encontrado.`);
    return kit;
  }

  /**
   * Converte pro formato EXATO que `GraphicComposerService` já espera
   * (`BrandKitDto` em `creative/graphic-composer/dto/compose-graphic.dto.ts`)
   * — permite o frontend buscar um kit salvo e usá-lo direto na chamada de
   * composição, sem remapear campos.
   */
  async toComposerDto(id: string, tenantId: string): Promise<{ palette: string[]; font_family?: string; logo_url?: string }> {
    const kit = await this.findOneOrFail(id, tenantId);
    return {
      palette: kit.palette,
      font_family: kit.font_family ?? undefined,
      logo_url: kit.logo_url ?? undefined,
    };
  }
}
