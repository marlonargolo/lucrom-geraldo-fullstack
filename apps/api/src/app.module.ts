import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { DatabaseModule } from './database/database.module';
import { StorageModule } from './storage/storage.module';
import { QueueModule } from './queue/queue.module';
import { TenantsModule } from './tenants/tenants.module';
import { MediaAssetsModule } from './media-assets/media-assets.module';
import { ConsentModule } from './consent/consent.module';
import { AuditModule } from './audit/audit.module';
import { QualityDirectorModule } from './quality-director/quality-director.module';
import { M8Module } from './engines/m8/m8.module';
import { VideoEditModule } from './engines/m8/edit/video-edit.module';
import { FormatExportModule } from './engines/m8/format-export/format-export.module';
import { HealthController } from './health/health.controller';
import { ScriptGeneratorModule } from './creative/script-generator/script-generator.module';
import { GraphicComposerModule } from './creative/graphic-composer/graphic-composer.module';
import { VoiceCommandsModule } from './creative/voice-commands/voice-commands.module';
import { MotionGraphicsModule } from './engines/m8/motion-graphics/motion-graphics.module';
import { AuditTrailModule } from './audit-trail/audit-trail.module';
import { AiOrchestratorModule } from './engines/m8/ai-orchestrator/ai-orchestrator.module';
import { WebhooksModule } from './webhooks/webhooks.module';
// ─── Avatar Real + Voz Clonada + Lip-Sync (Kling + MiniMax, sem fornecedor novo) ───
import { AvatarOrchestratorModule } from './engines/avatar/avatar-orchestrator.module';
import { AvatarWebhooksModule } from './avatar-webhooks/avatar-webhooks.module';
// ─── Identidade Digital Reutilizável — camada de conveniência sobre os dois módulos acima + ScriptGeneratorModule ───
import { DigitalTwinModule } from './digital-twin/digital-twin.module';
import { DirectorModule } from './engines/director/director.module';
import { AuthAuditMiddleware } from './common/middleware/auth-audit.middleware';
import { RedisModule } from './common/redis/redis.module';
import { AuthModule } from './auth/auth.module';
import { UsageModule } from './usage/usage.module';
import { BrandModule } from './brand/brand.module';
import { BillingModule } from './billing/billing.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    DatabaseModule,
    RedisModule,
    StorageModule,
    QueueModule,
    // ─── Cadastro/Login (Fase 1) + Cotas de Negócio + Brand Kit/Nicho (Fase 2) ───
    AuthModule,
    UsageModule,
    BrandModule,
    BillingModule,
    // ─── Módulos referenciados no app.module.ts de "lucrom-studio-COMPLETO-FINAL"
    // (PreFlightModule, RealtimeGatewayModule, SocialIntegrationsModule,
    // ContractsModule, ObservabilityModule, EventBusModule) continuam sem
    // código-fonte nem especificação em nenhum pacote recebido — pendente de
    // escopo, não incluídos.
    //
    // DirectorEngineModule (+ Business/Strategy/Creative como orquestração,
    // não como módulos próprios) foi implementado nesta entrega
    // (engines/director/*): sessão CREATED→BUSINESS→STRATEGY→CREATIVE→
    // PRODUCTION, reaproveitando BrandKitsService e ScriptGeneratorService
    // já existentes em vez de duplicar lógica de IA. QUALITY/DONE/
    // LearningEngineModule continuam fora — sem rota de avanço, mesma razão
    // dos módulos acima (sem especificação).
    DirectorModule,
    TenantsModule,
    MediaAssetsModule,
    ConsentModule,
    AuditModule,
    QualityDirectorModule,
    M8Module,
    // ─── Lacunas 1-5 (Script Generator, Graphic Composer, Voice Commands, Motion Graphics) ───
    ScriptGeneratorModule,
    GraphicComposerModule,
    VoiceCommandsModule,
    MotionGraphicsModule,
    // ─── Edição pós-geração + Export multi-formato (conectam FfmpegService/
    // GraphicComposerService/Script.contract já existentes a um fluxo de produto) ───
    VideoEditModule,
    FormatExportModule,
    // ─── Unificação + Auditoria (AuthAuditMiddleware, IA assíncrona + webhooks) ───
    AuditTrailModule,
    AiOrchestratorModule,
    WebhooksModule,
    // ─── Avatar Real + Voz Clonada + Lip-Sync (Kling + MiniMax) ───
    AvatarOrchestratorModule,
    AvatarWebhooksModule,
    // ─── Identidade Digital Reutilizável (camada de conveniência) ───
    DigitalTwinModule,
  ],
  controllers: [HealthController],
  providers: [AuthAuditMiddleware],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Aplicado a TODAS as rotas — o próprio middleware filtra por método de
    // escrita (POST/PUT/PATCH/DELETE); GETs passam direto sem overhead de gravação.
    consumer.apply(AuthAuditMiddleware).forRoutes('*');
  }
}
