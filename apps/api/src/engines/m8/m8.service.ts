import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import { Repository } from 'typeorm';
import { RenderJob } from './render-job.entity';
import { MediaAsset } from '../../media-assets/media-asset.entity';
import { Tenant } from '../../tenants/tenant.entity';
import { QUEUE_RENDER_HIGH_PRIORITY, QUEUE_RENDER_STANDARD, queueForPlanTier, M8RenderJobData } from '../../queue/queue.constants';
import { RenderM8Dto } from './dto/render-m8.dto';

@Injectable()
export class M8Service {
  constructor(
    @InjectRepository(RenderJob) private readonly jobs: Repository<RenderJob>,
    @InjectRepository(MediaAsset) private readonly assets: Repository<MediaAsset>,
    @InjectRepository(Tenant) private readonly tenants: Repository<Tenant>,
    @InjectQueue(QUEUE_RENDER_HIGH_PRIORITY) private readonly highPriorityQueue: Queue<M8RenderJobData>,
    @InjectQueue(QUEUE_RENDER_STANDARD) private readonly standardQueue: Queue<M8RenderJobData>,
  ) {}

  async enqueueRender(dto: RenderM8Dto): Promise<RenderJob> {
    const tenant = await this.tenants.findOne({ where: { id: dto.tenant_id } });
    if (!tenant) throw new BadRequestException(`Tenant ${dto.tenant_id} não encontrado.`);

    const rawAsset = await this.assets.findOne({ where: { tenant_id: dto.tenant_id, s3_key: dto.raw_video_key } });
    if (!rawAsset) {
      throw new BadRequestException(
        `raw_video_key "${dto.raw_video_key}" não corresponde a nenhum asset enviado por este tenant. Faça upload primeiro em POST /api/v1/media-assets/upload.`,
      );
    }

    const queueName = queueForPlanTier(tenant.plan_tier);

    const job = this.jobs.create({
      tenant_id: dto.tenant_id,
      script_id: dto.script_id,
      raw_asset_id: rawAsset.id,
      pipeline_options: dto.pipeline_options as unknown as Record<string, unknown>,
      brand_kit_snapshot: dto.brand_kit ? { palette: dto.brand_kit.palette, forbidden_words: dto.brand_kit.forbidden_words ?? [] } : null,
      status: 'QUEUED',
      queue_name: queueName,
    });
    const saved = await this.jobs.save(job);

    const queue = queueName === QUEUE_RENDER_HIGH_PRIORITY ? this.highPriorityQueue : this.standardQueue;
    const jobData: M8RenderJobData = {
      renderJobId: saved.id,
      tenantId: dto.tenant_id,
      scriptId: dto.script_id,
      rawAssetId: rawAsset.id,
      pipelineOptions: dto.pipeline_options,
      brandKit: dto.brand_kit ? { palette: dto.brand_kit.palette, forbiddenWords: dto.brand_kit.forbidden_words } : null,
      referenceVideoKey: dto.reference_video_key ?? null,
      scriptText: dto.script_text ?? null,
    };
    const bullJob = await queue.add('m8-render', jobData, { attempts: 2, backoff: { type: 'exponential', delay: 5000 } });

    saved.queue_job_id = bullJob.id ?? null;
    return this.jobs.save(saved);
  }

  async findOneOrFail(id: string, tenantId: string) {
    const job = await this.jobs.findOne({ where: { id, tenant_id: tenantId } });
    if (!job) throw new NotFoundException(`Render job ${id} não encontrado.`);
    return job;
  }

  findByTenant(tenantId: string) {
    return this.jobs.find({ where: { tenant_id: tenantId }, order: { created_at: 'DESC' } });
  }
}
