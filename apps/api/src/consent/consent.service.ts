import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { ConsentRecord, ConsentSubjectType } from './consent-record.entity';

@Injectable()
export class ConsentService {
  constructor(@InjectRepository(ConsentRecord) private readonly repo: Repository<ConsentRecord>) {}

  create(params: {
    tenantId: string;
    subjectType: ConsentSubjectType;
    subjectName: string;
    contractS3Key?: string;
    expiresAt?: Date;
  }) {
    const record = this.repo.create({
      tenant_id: params.tenantId,
      subject_type: params.subjectType,
      subject_name: params.subjectName,
      contract_s3_key: params.contractS3Key ?? null,
      status: 'LEGAL_CONSENT_GRANTED',
      granted_at: new Date(),
      revoked_at: null,
      expires_at: params.expiresAt ?? null,
    });
    return this.repo.save(record);
  }

  async revoke(id: string) {
    await this.repo.update({ id }, { revoked_at: new Date(), status: 'LEGAL_CONSENT_REVOKED' });
    return this.repo.findOne({ where: { id } });
  }

  findByTenant(tenantId: string) {
    return this.repo.find({ where: { tenant_id: tenantId }, order: { created_at: 'DESC' } });
  }

  /**
   * Bloqueio ativo exigido na Seção 12: recusa gerar conteúdo com qualquer
   * identidade fora do cadastro, ou cujo consentimento tenha sido revogado
   * ou expirado — testado, não apenas assumido.
   */
  async hasValidConsent(tenantId: string, subjectType: ConsentSubjectType, subjectName: string): Promise<boolean> {
    const now = new Date();
    const record = await this.repo.findOne({
      where: {
        tenant_id: tenantId,
        subject_type: subjectType,
        subject_name: subjectName,
        revoked_at: IsNull(),
      },
    });
    if (!record || record.revoked_at) return false;
    if (record.expires_at && record.expires_at <= now) return false;
    return true;
  }
}
