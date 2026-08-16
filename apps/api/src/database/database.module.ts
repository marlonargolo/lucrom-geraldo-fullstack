import { Module } from '@nestjs/common';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Tenant } from '../tenants/tenant.entity';
import { MediaAsset } from '../media-assets/media-asset.entity';
import { AuditGateLog } from '../audit/audit-gate-log.entity';
import { ConsentRecord } from '../consent/consent-record.entity';
import { RenderJob } from '../engines/m8/render-job.entity';
import { QualityIteration } from '../quality-director/quality-iteration.entity';
import { Script } from '../creative/script-generator/script.entity';
import { GraphicComposition } from '../creative/graphic-composer/graphic-composition.entity';
import { VoiceCommand } from '../creative/voice-commands/voice-command.entity';
import { AuditLog } from '../audit-trail/audit-log.entity';
import { AiGenerationJob } from '../engines/m8/ai-orchestrator/ai-generation-job.entity';
import { User } from '../auth/user.entity';
import { NichePreset } from '../brand/entities/niche-preset.entity';
import { BrandKit } from '../brand/entities/brand-kit.entity';
import { Payment } from '../billing/payment.entity';
import { VideoEdit } from '../engines/m8/edit/video-edit.entity';
import { FormatExport } from '../engines/m8/format-export/format-export.entity';
import { ProjectSession } from '../engines/director/project-session.entity';
import { BusinessTicket } from '../engines/director/business-ticket.entity';
import { StrategyBrief } from '../engines/director/strategy-brief.entity';
import { CreativeManifest } from '../engines/director/creative-manifest.entity';
import { ProductionContract } from '../engines/director/production-contract.entity';
import { VoiceProfile } from '../engines/avatar/voice-profile.entity';
import { AvatarProfile } from '../engines/avatar/avatar-profile.entity';
import { AvatarGenerationJob } from '../engines/avatar/avatar-generation-job.entity';
import { InitSchema1753900000000 } from './migrations/1753900000000-InitSchema';
import { AddQualityIterations1753900100000 } from './migrations/1753900100000-AddQualityIterations';
import { AddPipelineV2Fields1753900200000 } from './migrations/1753900200000-AddPipelineV2Fields';
import { AddCreativeSuiteTables1753900300000 } from './migrations/1753900300000-AddCreativeSuiteTables';
import { AddAuditAndAiGenerationTables1753900400000 } from './migrations/1753900400000-AddAuditAndAiGenerationTables';
import { AddConsentStatus1753900500000 } from './migrations/1753900500000-AddConsentStatus';
import { AddAuthUsageAndBrandTables1753900600000 } from './migrations/1753900600000-AddAuthUsageAndBrandTables';
import { AddPayments1753900700000 } from './migrations/1753900700000-AddPayments';
import { AddVideoEditAndFormatExport1753900800000 } from './migrations/1753900800000-AddVideoEditAndFormatExport';
// Director Engine: registra as 5 entidades (ProjectSession, BusinessTicket,
// StrategyBrief, CreativeManifest, ProductionContract) e sua migration.
import { AddDirectorEngine1753900900000 } from './migrations/1753900900000-AddDirectorEngine';
// Avatar Engine: avatar real + voz clonada + lip-sync, via Kling + MiniMax.
import { AddAvatarEngine1754000000000 } from './migrations/1754000000000-AddAvatarEngine';
// Conecta advanceProduction do Director Engine ao pipeline real de vídeo.
import { AddAiGenerationJobToProductionContract1754100000000 } from './migrations/1754100000000-AddAiGenerationJobToProductionContract';
// Módulo Ajuste Rápido Humano: camadas editáveis + versionamento no GraphicComposer, sem custo de IA.
import { AddQuickAdjustLayers1754200000000 } from './migrations/1754200000000-AddQuickAdjustLayers';

const ENTITIES = [
  Tenant,
  MediaAsset,
  AuditGateLog,
  ConsentRecord,
  RenderJob,
  QualityIteration,
  Script,
  GraphicComposition,
  VoiceCommand,
  AuditLog,
  AiGenerationJob,
  User,
  NichePreset,
  BrandKit,
  Payment,
  VideoEdit,
  FormatExport,
  ProjectSession,
  BusinessTicket,
  StrategyBrief,
  CreativeManifest,
  ProductionContract,
  VoiceProfile,
  AvatarProfile,
  AvatarGenerationJob,
];
const MIGRATIONS = [
  InitSchema1753900000000,
  AddQualityIterations1753900100000,
  AddPipelineV2Fields1753900200000,
  AddCreativeSuiteTables1753900300000,
  AddAuditAndAiGenerationTables1753900400000,
  AddConsentStatus1753900500000,
  AddAuthUsageAndBrandTables1753900600000,
  AddPayments1753900700000,
  AddVideoEditAndFormatExport1753900800000,
  AddDirectorEngine1753900900000,
  AddAvatarEngine1754000000000,
  AddAiGenerationJobToProductionContract1754100000000,
  AddQuickAdjustLayers1754200000000,
];

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService): TypeOrmModuleOptions => {
        const databaseUrl = process.env.DATABASE_URL;
        const isLogging = config.get('nodeEnv') === 'development';

        const sharedOptions = {
          entities: ENTITIES,
          migrations: MIGRATIONS,
          migrationsRun: true,
          synchronize: false,
          logging: isLogging,
          // Allow self-signed certs in Replit Postgres environment
          extra: { ssl: databaseUrl ? { rejectUnauthorized: false } : undefined },
        };

        if (databaseUrl) {
          return { type: 'postgres', url: databaseUrl, ...sharedOptions };
        }

        return {
          type: 'postgres',
          host: config.get<string>('db.host'),
          port: config.get<number>('db.port'),
          username: config.get<string>('db.user'),
          password: config.get<string>('db.password'),
          database: config.get<string>('db.name'),
          ...sharedOptions,
        };
      },
    }),
  ],
})
export class DatabaseModule {}
