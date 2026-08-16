import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditGateLog } from './audit-gate-log.entity';
import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';
import { FidelityService } from './fidelity.service';
import { GatesService } from './gates.service';

@Module({
  imports: [TypeOrmModule.forFeature([AuditGateLog])],
  providers: [AuditService, FidelityService, GatesService],
  controllers: [AuditController],
  exports: [AuditService, FidelityService, GatesService],
})
export class AuditModule {}
