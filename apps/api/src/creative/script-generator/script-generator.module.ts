import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Script } from './script.entity';
import { Tenant } from '../../tenants/tenant.entity';
import { ScriptGeneratorService } from './script-generator.service';
import { ScriptGeneratorController } from './script-generator.controller';
import { LlmClientModule } from '../llm/llm-client.module';

@Module({
  imports: [TypeOrmModule.forFeature([Script, Tenant]), LlmClientModule],
  providers: [ScriptGeneratorService],
  controllers: [ScriptGeneratorController],
  exports: [ScriptGeneratorService],
})
export class ScriptGeneratorModule {}
