import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { VoiceProfile } from './voice-profile.entity';
import { AvatarProfile } from './avatar-profile.entity';
import { AvatarGenerationJob } from './avatar-generation-job.entity';
import { ConsentRecord } from '../../consent/consent-record.entity';
import { MediaAssetsService } from '../../media-assets/media-assets.service';
import { StorageService } from '../../storage/storage.service';
import { KlingClientService } from '../m8/ai-orchestrator/kling-client.service';
import { MinimaxClientService } from '../m8/ai-orchestrator/minimax-client.service';
import { CloneVoiceDto } from './dto/clone-voice.dto';
import { CreateAvatarProfileDto } from './dto/create-avatar-profile.dto';
import { GenerateAvatarVideoDto } from './dto/generate-avatar-video.dto';

/**
 * AvatarOrchestratorService — Avatar real do tenant + voz clonada + lip-sync.
 *
 * Decisão registrada na conversa que precedeu esta implementação: em vez de
 * trazer HeyGen (avatar) + ElevenLabs (voz) como fornecedores NOVOS, esta
 * capacidade foi construída 100% em cima dos DOIS provedores que o projeto
 * já paga e já protege (Kling para lip-sync, MiniMax para voz) — zero
 * superfície de segurança nova, zero assinatura nova.
 *
 * Cada método abaixo tem UMA responsabilidade só, no mesmo espírito do
 * M8ProcessorCore (cada peça faz uma coisa, nenhuma "toma conta" da função
 * da outra):
 *   • cloneVoice()        → só fala com a MiniMax (voz).
 *   • createAvatarProfile() → só fala com a Kling (detecção de rosto).
 *   • generateVideo()     → ORQUESTRA as duas: sintetiza a narração (MiniMax),
 *                           sobe pro storage, manda pro Kling aplicar lip-sync.
 *                           Não decide nada de voz nem de rosto sozinho —
 *                           só encadeia o que os dois métodos acima já produziram.
 */
@Injectable()
export class AvatarOrchestratorService {
  private readonly logger = new Logger(AvatarOrchestratorService.name);
  private readonly publicWebhookBaseUrl: string;

  constructor(
    @InjectRepository(VoiceProfile) private readonly voiceProfiles: Repository<VoiceProfile>,
    @InjectRepository(AvatarProfile) private readonly avatarProfiles: Repository<AvatarProfile>,
    @InjectRepository(AvatarGenerationJob) private readonly jobs: Repository<AvatarGenerationJob>,
    @InjectRepository(ConsentRecord) private readonly consentRecords: Repository<ConsentRecord>,
    private readonly mediaAssets: MediaAssetsService,
    private readonly storage: StorageService,
    private readonly kling: KlingClientService,
    private readonly minimax: MinimaxClientService,
    private readonly config: ConfigService,
  ) {
    // Reaproveita a MESMA base de webhook público já configurada para o
    // ai-orchestrator (AI_ORCHESTRATOR_PUBLIC_WEBHOOK_BASE_URL) — nenhuma
    // variável de ambiente nova precisa ser adicionada por causa disso.
    this.publicWebhookBaseUrl = this.config.get<string>('aiOrchestrator.publicWebhookBaseUrl') ?? 'http://localhost:3000';
  }

  // ─── Consentimento (Seção 12 do doc mestre, reaproveitando ConsentModule) ──

  /** Confirma um `consent_records` válido (não revogado, não expirado) do tipo e tenant certos. */
  private async assertConsent(tenantId: string, consentRecordId: string, subjectType: 'face' | 'voice'): Promise<void> {
    const record = await this.consentRecords.findOne({
      where: { id: consentRecordId, tenant_id: tenantId, subject_type: subjectType, revoked_at: IsNull() },
    });
    if (!record) {
      throw new ForbiddenException(
        `Nenhum consentimento válido (subject_type='${subjectType}') encontrado para o registro ${consentRecordId} — geração de avatar/voz bloqueada.`,
      );
    }
    if (record.expires_at && record.expires_at <= new Date()) {
      throw new ForbiddenException(`Consentimento ${consentRecordId} expirou em ${record.expires_at.toISOString()} — geração bloqueada.`);
    }
  }

  // ─── 1) Clonagem de voz (MiniMax) ──────────────────────────────────────

  async cloneVoice(dto: CloneVoiceDto): Promise<VoiceProfile> {
    await this.assertConsent(dto.tenant_id, dto.consent_record_id, 'voice');

    const profile = this.voiceProfiles.create({
      tenant_id: dto.tenant_id,
      name: dto.name,
      source_asset_id: dto.source_asset_id,
      status: 'PENDING',
    });
    await this.voiceProfiles.save(profile);

    let tempPath: string | null = null;
    try {
      const { path, asset } = await this.mediaAssets.downloadToTemp(dto.source_asset_id, dto.tenant_id);
      tempPath = path;
      const fs = await import('fs/promises');
      const buffer = await fs.readFile(path);

      const { fileId } = await this.minimax.uploadFile({
        buffer,
        fileName: `voice-sample-${profile.id}.${asset.file_type.split('/')[1] ?? 'wav'}`,
        purpose: 'voice_clone',
      });

      const customVoiceId = `lucrom-${dto.tenant_id.slice(0, 8)}-${randomUUID().slice(0, 8)}`;
      await this.minimax.cloneVoice({ fileId, voiceId: customVoiceId });

      profile.external_voice_id = customVoiceId;
      profile.status = 'READY';
      await this.voiceProfiles.save(profile);
      this.logger.log(`voice_profile ${profile.id} clonado com sucesso na MiniMax (voice_id=${customVoiceId}).`);
    } catch (err) {
      profile.status = 'FAILED';
      profile.error_message = (err as Error).message;
      await this.voiceProfiles.save(profile);
      this.logger.error(`Falha ao clonar voz (voice_profile ${profile.id}): ${(err as Error).message}`);
    } finally {
      if (tempPath) {
        const fs = await import('fs/promises');
        await fs.unlink(tempPath).catch(() => undefined);
      }
    }

    return profile;
  }

  // ─── 2) Identificação de rosto (Kling) ─────────────────────────────────

  async createAvatarProfile(dto: CreateAvatarProfileDto): Promise<AvatarProfile> {
    await this.assertConsent(dto.tenant_id, dto.consent_record_id, 'face');

    const profile = this.avatarProfiles.create({
      tenant_id: dto.tenant_id,
      name: dto.name,
      source_asset_id: dto.source_asset_id,
      consent_record_id: dto.consent_record_id,
      status: 'PENDING',
    });
    await this.avatarProfiles.save(profile);

    try {
      const videoUrl = await this.mediaAssets.presignedUrlFor(
        await this.mediaAssets.findOneOrFail(dto.source_asset_id, dto.tenant_id),
      );
      const { sessionId, faceId } = await this.kling.identifyFace({ videoUrl });

      profile.kling_session_id = sessionId;
      profile.kling_face_id = faceId;
      profile.status = 'READY';
      await this.avatarProfiles.save(profile);
      this.logger.log(`avatar_profile ${profile.id}: rosto identificado na Kling (session=${sessionId}, face=${faceId}).`);
    } catch (err) {
      profile.status = 'FAILED';
      profile.error_message = (err as Error).message;
      await this.avatarProfiles.save(profile);
      this.logger.error(`Falha ao identificar rosto (avatar_profile ${profile.id}): ${(err as Error).message}`);
    }

    return profile;
  }

  // ─── 3) Geração do vídeo final (orquestra os dois acima) ───────────────

  /**
   * Aceita a requisição e retorna IMEDIATAMENTE (o controller responde
   * 202) — mesmo padrão assíncrono do AiOrchestratorService. A ETAPA 1
   * (síntese de voz via MiniMax) roda de forma síncrona ANTES de responder,
   * porque a MiniMax não é assíncrona nessa chamada; só a ETAPA 2 (lip-sync
   * via Kling) é assíncrona de verdade e depende do webhook.
   */
  async generateVideo(dto: GenerateAvatarVideoDto): Promise<AvatarGenerationJob> {
    const voiceProfile = await this.voiceProfiles.findOne({ where: { id: dto.voice_profile_id, tenant_id: dto.tenant_id } });
    if (!voiceProfile || voiceProfile.status !== 'READY' || !voiceProfile.external_voice_id) {
      throw new BadRequestException(`voice_profile ${dto.voice_profile_id} não está pronto (status READY exigido).`);
    }

    const avatarProfile = await this.avatarProfiles.findOne({ where: { id: dto.avatar_profile_id, tenant_id: dto.tenant_id } });
    if (!avatarProfile || avatarProfile.status !== 'READY' || !avatarProfile.kling_session_id || !avatarProfile.kling_face_id) {
      throw new BadRequestException(`avatar_profile ${dto.avatar_profile_id} não está pronto (status READY exigido).`);
    }

    // Re-checa consentimento a CADA geração (não só na criação do profile) —
    // garante que uma revogação feita depois da criação do avatar_profile
    // bloqueia gerações futuras imediatamente, sem esperar nenhum job de limpeza.
    await this.assertConsent(dto.tenant_id, avatarProfile.consent_record_id, 'face');

    const job = this.jobs.create({
      tenant_id: dto.tenant_id,
      avatar_profile_id: dto.avatar_profile_id,
      voice_profile_id: dto.voice_profile_id,
      script_text: dto.script_text,
      aspect_ratio: dto.aspect_ratio,
      status: 'SYNTHESIZING_VOICE',
    });
    await this.jobs.save(job);

    try {
      // ETAPA 1 — MiniMax sintetiza a narração na voz clonada (síncrono).
      const audioBuffer = await this.minimax.synthesizeSpeech({
        voiceId: voiceProfile.external_voice_id,
        text: dto.script_text,
      });
      voiceProfile.last_used_at = new Date();
      await this.voiceProfiles.save(voiceProfile);

      // Sobe o áudio pro storage (mesmo bucket de sempre) e gera URL pública
      // temporária — a Kling precisa conseguir BAIXAR o áudio, não aceita binário direto.
      const narrationAsset = await this.mediaAssets.uploadAndRegister({
        tenantId: dto.tenant_id,
        buffer: audioBuffer,
        contentType: 'audio/mpeg',
        fileType: 'audio/mpeg',
        engineSource: 'AVATAR_ENGINE',
        extraMetadata: { source: 'avatar_generation_job', avatar_generation_job_id: job.id },
      });
      job.narration_s3_key = narrationAsset.s3_key;
      const narrationPublicUrl = await this.storage.presignedGetUrl(narrationAsset.s3_key);

      // ETAPA 2 — Kling aplica lip-sync (assíncrono; resultado via webhook).
      const externalTaskId = randomUUID();
      const webhookUrl = `${this.publicWebhookBaseUrl}/api/v1/webhooks/avatar-video`;
      const { taskId } = await this.kling.submitLipSync({
        sessionId: avatarProfile.kling_session_id,
        faceId: avatarProfile.kling_face_id,
        soundFileUrl: narrationPublicUrl,
        callbackUrl: webhookUrl,
        externalTaskId,
      });

      job.external_task_id = taskId;
      job.status = 'PROCESSING_LIPSYNC';
      await this.jobs.save(job);
      this.logger.log(`avatar_generation_job ${job.id}: narração pronta, lip-sync submetido à Kling (task=${taskId}).`);
    } catch (err) {
      job.status = 'FAILED';
      job.error_message = (err as Error).message;
      await this.jobs.save(job);
      this.logger.error(`Falha ao gerar vídeo de avatar (job ${job.id}): ${(err as Error).message}`);
    }

    return job;
  }

  // ─── Busca de identidade reutilizável (usado pelo DigitalTwinModule) ────

  /**
   * `voice_profile` READY mais recente do tenant — é o que permite o fluxo
   * "prompt simples" (DigitalTwinService.generateFromPrompt) não pedir
   * voice_profile_id: reaproveita automaticamente o que já foi clonado no
   * setup, sem o tenant precisar saber IDs internos.
   */
  findLatestReadyVoiceProfile(tenantId: string): Promise<VoiceProfile | null> {
    return this.voiceProfiles.findOne({
      where: { tenant_id: tenantId, status: 'READY' },
      order: { created_at: 'DESC' },
    });
  }

  /** Mesma lógica acima, para `avatar_profile`. */
  findLatestReadyAvatarProfile(tenantId: string): Promise<AvatarProfile | null> {
    return this.avatarProfiles.findOne({
      where: { tenant_id: tenantId, status: 'READY' },
      order: { created_at: 'DESC' },
    });
  }

  findOneOrFail(id: string, tenantId: string) {
    return this.jobs.findOneOrFail({ where: { id, tenant_id: tenantId } }).catch(() => {
      throw new NotFoundException(`avatar_generation_job ${id} não encontrado.`);
    });
  }

  findByTenant(tenantId: string) {
    return this.jobs.find({ where: { tenant_id: tenantId }, order: { created_at: 'DESC' } });
  }

  /** Usado pelo AvatarWebhooksController para localizar o job pelo task_id da Kling. */
  findByExternalTaskId(externalTaskId: string) {
    return this.jobs.findOne({ where: { external_task_id: externalTaskId } });
  }

  save(job: AvatarGenerationJob) {
    return this.jobs.save(job);
  }
}
