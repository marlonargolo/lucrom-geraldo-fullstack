import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditGateLog, GateStage } from './audit-gate-log.entity';
import { GateResult } from './gates.service';

@Injectable()
export class AuditService {
  constructor(@InjectRepository(AuditGateLog) private readonly repo: Repository<AuditGateLog>) {}

  async logGateResult(params: {
    tenantId: string;
    assetId: string | null;
    stage: GateStage;
    result: GateResult;
  }): Promise<AuditGateLog> {
    const failedChecks = params.result.checks.filter((c) => !c.ok).map((c) => `${c.label}: ${c.detail}`);
    const log = this.repo.create({
      tenant_id: params.tenantId,
      asset_id: params.assetId,
      gate_stage: params.stage,
      status: params.result.passed ? 'PASSED' : 'FAILED',
      qa_score: params.result.score,
      rejection_reason: failedChecks.length ? failedChecks.join(' | ') : null,
      checks: params.result.checks,
    });
    return this.repo.save(log);
  }

  findByAsset(assetId: string) {
    return this.repo.find({ where: { asset_id: assetId }, order: { audited_at: 'ASC' } });
  }

  findByTenant(tenantId: string) {
    return this.repo.find({ where: { tenant_id: tenantId }, order: { audited_at: 'DESC' }, take: 200 });
  }
}
