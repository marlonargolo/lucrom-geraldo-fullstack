import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QualityIteration } from './quality-iteration.entity';
import { QualityIterationsService } from './quality-iterations.service';
import { QualityIterationsController } from './quality-iterations.controller';
import { QualityDirectorService } from './quality-director.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [TypeOrmModule.forFeature([QualityIteration]), AuditModule],
  providers: [QualityDirectorService, QualityIterationsService],
  controllers: [QualityIterationsController],
  exports: [QualityDirectorService, QualityIterationsService],
})
export class QualityDirectorModule {}
