import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { AiOrchestratorModule } from '../../engines/m8/ai-orchestrator/ai-orchestrator.module';
import { LlmClientModule } from '../llm/llm-client.module';
import { BriefingController } from './briefing.controller';
import { BriefingService } from './briefing.service';

@Module({
  imports: [AuthModule, LlmClientModule, AiOrchestratorModule],
  controllers: [BriefingController],
  providers: [BriefingService],
})
export class BriefingModule {}
