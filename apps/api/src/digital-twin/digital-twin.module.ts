import { Module } from '@nestjs/common';
import { AvatarOrchestratorModule } from '../engines/avatar/avatar-orchestrator.module';
import { ScriptGeneratorModule } from '../creative/script-generator/script-generator.module';
import { DigitalTwinService } from './digital-twin.service';
import { DigitalTwinController } from './digital-twin.controller';

/**
 * Identidade Digital Reutilizável (Digital Twin) — módulo 100% de
 * ORQUESTRAÇÃO: importa `AvatarOrchestratorModule` (voz MiniMax + avatar
 * Kling, já com TypeORM/entidades próprias) e `ScriptGeneratorModule`
 * (roteiro via LLM/DeepSeek), e expõe só os dois endpoints de conveniência
 * (`/setup`, `/generate-video`). Sem `TypeOrmModule.forFeature` aqui —
 * de propósito, este módulo não é dono de nenhuma tabela.
 */
@Module({
  imports: [AvatarOrchestratorModule, ScriptGeneratorModule],
  providers: [DigitalTwinService],
  controllers: [DigitalTwinController],
})
export class DigitalTwinModule {}
