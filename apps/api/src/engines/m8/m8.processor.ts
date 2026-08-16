import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_RENDER_HIGH_PRIORITY, QUEUE_RENDER_STANDARD, M8RenderJobData } from '../../queue/queue.constants';
import { M8ProcessorCore } from './m8-processor.core';

@Processor(QUEUE_RENDER_HIGH_PRIORITY)
export class M8HighPriorityProcessor extends WorkerHost {
  private readonly logger = new Logger(M8HighPriorityProcessor.name);
  constructor(private readonly core: M8ProcessorCore) {
    super();
  }
  async process(job: Job<M8RenderJobData>) {
    this.logger.log(`[${QUEUE_RENDER_HIGH_PRIORITY}] processando job ${job.id} (render_job=${job.data.renderJobId})`);
    return this.core.handle(job.data);
  }
}

@Processor(QUEUE_RENDER_STANDARD)
export class M8StandardProcessor extends WorkerHost {
  private readonly logger = new Logger(M8StandardProcessor.name);
  constructor(private readonly core: M8ProcessorCore) {
    super();
  }
  async process(job: Job<M8RenderJobData>) {
    this.logger.log(`[${QUEUE_RENDER_STANDARD}] processando job ${job.id} (render_job=${job.data.renderJobId})`);
    return this.core.handle(job.data);
  }
}
