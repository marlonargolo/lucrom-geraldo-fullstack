import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateNichePresetDto } from './dto/create-niche-preset.dto';
import { NichePreset } from './entities/niche-preset.entity';

@Injectable()
export class NichePresetsService {
  constructor(@InjectRepository(NichePreset) private readonly repo: Repository<NichePreset>) {}

  findAll() {
    return this.repo.find({ order: { label: 'ASC' } });
  }

  async findOneOrFail(id: string): Promise<NichePreset> {
    const preset = await this.repo.findOne({ where: { id } });
    if (!preset) throw new NotFoundException(`Niche preset ${id} não encontrado.`);
    return preset;
  }

  async create(dto: CreateNichePresetDto): Promise<NichePreset> {
    const existing = await this.repo.findOne({ where: { key: dto.key } });
    if (existing) throw new ConflictException(`Já existe um niche preset com key "${dto.key}".`);

    const preset = this.repo.create({
      key: dto.key,
      label: dto.label,
      description: dto.description ?? null,
    });
    return this.repo.save(preset);
  }
}
