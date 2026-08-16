import { Module } from '@nestjs/common';
import { QueueModule } from '../queue/queue.module';
import { AiOrchestratorModule } from '../engines/m8/ai-orchestrator/ai-orchestrator.module';
import { WebhooksController } from './webhooks.controller';

@Module({
  imports: [QueueModule, AiOrchestratorModule],
  controllers: [WebhooksController],
})
export class WebhooksModule {}
