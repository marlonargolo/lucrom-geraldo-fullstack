import { Module } from '@nestjs/common';
import { QueueModule } from '../queue/queue.module';
import { AvatarOrchestratorModule } from '../engines/avatar/avatar-orchestrator.module';
import { AvatarWebhooksController } from './avatar-webhooks.controller';

/**
 * Módulo NOVO e SEPARADO de `webhooks.module.ts` — mesmo raciocínio do
 * `avatar-webhooks.controller.ts` (preservar 100% os arquivos existentes).
 */
@Module({
  imports: [QueueModule, AvatarOrchestratorModule],
  controllers: [AvatarWebhooksController],
})
export class AvatarWebhooksModule {}
