import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './audit-log.entity';

@Injectable()
export class AuditLogService {
  constructor(@InjectRepository(AuditLog) private readonly repo: Repository<AuditLog>) {}

  async record(entry: {
    tenantId: string | null;
    actor: string;
    method: string;
    route: string;
    statusCode: number;
    ipAddress: string | null;
    requestBody: Record<string, unknown> | null;
    durationMs: number;
  }): Promise<void> {
    const log = this.repo.create({
      tenant_id: entry.tenantId,
      actor: entry.actor,
      method: entry.method,
      route: entry.route,
      status_code: entry.statusCode,
      ip_address: entry.ipAddress,
      request_body: entry.requestBody,
      duration_ms: entry.durationMs,
    });
    await this.repo.save(log);
  }

  findByTenant(tenantId: string, limit = 200) {
    return this.repo.find({ where: { tenant_id: tenantId }, order: { created_at: 'DESC' }, take: limit });
  }

  findRecent(limit = 200) {
    return this.repo.find({ order: { created_at: 'DESC' }, take: limit });
  }
}
