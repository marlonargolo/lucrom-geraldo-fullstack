import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QualityIteration } from './quality-iteration.entity';
import { DiagnosisReport } from './quality-director.types';

@Injectable()
export class QualityIterationsService {
  constructor(@InjectRepository(QualityIteration) private readonly repo: Repository<QualityIteration>) {}

  async record(params: {
    renderJobId: string;
    iterationNumber: number;
    diagnosis: DiagnosisReport;
    correctionApplied: Record<string, unknown> | null;
  }): Promise<QualityIteration> {
    const row = this.repo.create({
      render_job_id: params.renderJobId,
      iteration_number: params.iterationNumber,
      overall_score: params.diagnosis.overallScore,
      passed: params.diagnosis.passed,
      axes: params.diagnosis.axes,
      correction_applied: params.correctionApplied,
    });
    return this.repo.save(row);
  }

  findByRenderJob(renderJobId: string) {
    return this.repo.find({ where: { render_job_id: renderJobId }, order: { iteration_number: 'ASC' } });
  }
}
