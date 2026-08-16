import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
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

dotenv.config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USER ?? 'lucrom',
  password: process.env.DB_PASSWORD ?? 'lucrom',
  database: process.env.DB_NAME ?? 'lucrom_studio_ai',
  entities: [
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
  ],
  migrations: ['src/database/migrations/*.ts'],
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
});
