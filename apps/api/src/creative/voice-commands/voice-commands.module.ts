import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VoiceCommand } from './voice-command.entity';
import { Tenant } from '../../tenants/tenant.entity';
import { VoiceCommandService } from './voice-command.service';
import { VoiceCommandController } from './voice-command.controller';
import { LlmClientModule } from '../llm/llm-client.module';
import { MediaAssetsModule } from '../../media-assets/media-assets.module';
import { ReplicateClientService } from '../../engines/m8/replicate-client.service';

/**
 * `ReplicateClientService` é provido aqui (e não importado do M8Module) porque
 * o M8Module só o expõe dentro do M8WorkerModule (processo separado — ver
 * worker.module.ts), enquanto comandos de voz precisam de resposta síncrona
 * no processo HTTP da API. A classe é stateless (só depende de ConfigService),
 * então ter uma segunda instância aqui não duplica estado nem efeito colateral.
 */
@Module({
  imports: [TypeOrmModule.forFeature([VoiceCommand, Tenant]), LlmClientModule, MediaAssetsModule],
  providers: [VoiceCommandService, ReplicateClientService],
  controllers: [VoiceCommandController],
  exports: [VoiceCommandService],
})
export class VoiceCommandsModule {}
