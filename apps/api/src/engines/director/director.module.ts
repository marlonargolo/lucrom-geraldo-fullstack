import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectSession } from './project-session.entity';
import { BusinessTicket } from './business-ticket.entity';
import { StrategyBrief } from './strategy-brief.entity';
import { CreativeManifest } from './creative-manifest.entity';
import { ProductionContract } from './production-contract.entity';
import { DirectorService } from './director.service';
import { DirectorController } from './director.controller';
import { BrandModule } from '../../brand/brand.module';
import { ScriptGeneratorModule } from '../../creative/script-generator/script-generator.module';
import { AiOrchestratorModule } from '../m8/ai-orchestrator/ai-orchestrator.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ProjectSession, BusinessTicket, StrategyBrief, CreativeManifest, ProductionContract]),
    BrandModule,
    ScriptGeneratorModule,
    AiOrchestratorModule,
  ],
  providers: [DirectorService],
  controllers: [DirectorController],
  exports: [DirectorService],
})
export class DirectorModule {}
