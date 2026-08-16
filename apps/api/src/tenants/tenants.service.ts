import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from './tenant.entity';

@Injectable()
export class TenantsService {
  constructor(@InjectRepository(Tenant) private readonly repo: Repository<Tenant>) {}

  create(name: string, planTier: 'CREATOR' | 'ENTERPRISE' = 'CREATOR') {
    const tenant = this.repo.create({ name, plan_tier: planTier });
    return this.repo.save(tenant);
  }

  findAll() {
    return this.repo.find({ order: { created_at: 'DESC' } });
  }

  async findOneOrFail(id: string): Promise<Tenant> {
    const tenant = await this.repo.findOne({ where: { id } });
    if (!tenant) throw new NotFoundException(`Tenant ${id} não encontrado.`);
    return tenant;
  }
}
