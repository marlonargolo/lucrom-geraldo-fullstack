import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VoiceProfile } from './voice-profile.entity';
import { AvatarProfile } from './avatar-profile.entity';
import { AvatarGenerationJob } from './avatar-generation-job.entity';
import { ConsentRecord } from '../../consent/consent-record.entity';
import { AvatarOrchestratorService } from './avatar-orchestrator.service';
import { AvatarOrchestratorController } from './avatar-orchestrator.controller';
import { KlingClientService } from '../m8/ai-orchestrator/kling-client.service';
import { MinimaxClientService } from '../m8/ai-orchestrator/minimax-client.service';
import { MediaAssetsModule } from '../../media-assets/media-assets.module';

/**
 * Avatar Real + Voz Clonada + Lip-Sync (Kling + MiniMax).
 *
 * `KlingClientService`/`MinimaxClientService` são providers "puros"
 * (só dependem de `ConfigService`, sem estado compartilhado) — por isso são
 * fornecidos aqui de novo, do mesmo jeito que `AiOrchestratorModule` já os
 * fornece pra ele mesmo, em vez de importar aquele módulo inteiro só pra
 * reaproveitar dois serviços sem estado. `StorageModule` é `@Global()`,
 * não precisa ser importado aqui.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([VoiceProfile, AvatarProfile, AvatarGenerationJob, ConsentRecord]),
    MediaAssetsModule,
  ],
  providers: [AvatarOrchestratorService, KlingClientService, MinimaxClientService],
  controllers: [AvatarOrchestratorController],
  exports: [AvatarOrchestratorService, KlingClientService, MinimaxClientService],
})
export class AvatarOrchestratorModule {}
