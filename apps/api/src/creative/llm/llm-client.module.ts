import { Module } from '@nestjs/common';
import { LlmClientService } from './llm-client.service';

/**
 * Módulo compartilhado do cliente LLM — importado por ScriptGeneratorModule
 * e VoiceCommandsModule para evitar duplicar a configuração da API key/modelo.
 */
@Module({
  providers: [LlmClientService],
  exports: [LlmClientService],
})
export class LlmClientModule {}
