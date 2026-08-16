import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiGenerationJob } from './ai-generation-job.entity';
import { Tenant } from '../../../tenants/tenant.entity';
import { AiOrchestratorService } from './ai-orchestrator.service';
import { AiOrchestratorController } from './ai-orchestrator.controller';
import { KlingClientService } from './kling-client.service';
import { MinimaxClientService } from './minimax-client.service';
import { UsageModule } from '../../../usage/usage.module';

/**
 * Provê `KlingClientService` e `MinimaxClientService`, os clientes diretos
 * usados na geração de vídeo assíncrona. `MinimaxClientService` também é
 * exportado porque o WebhooksModule precisa dele para resolver `file_id`
 * em URL de download (ver webhooks.controller.ts).
 */
@Module({
  imports: [TypeOrmModule.forFeature([AiGenerationJob, Tenant]), UsageModule],
  providers: [AiOrchestratorService, KlingClientService, MinimaxClientService],
  controllers: [AiOrchestratorController],
  exports: [AiOrchestratorService, MinimaxClientService],
})
export class AiOrchestratorModule {}
