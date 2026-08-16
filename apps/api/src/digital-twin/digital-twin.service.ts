import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { AvatarOrchestratorService } from '../engines/avatar/avatar-orchestrator.service';
import { ScriptGeneratorService, ScriptContract } from '../creative/script-generator/script-generator.service';
import { AvatarGenerationJob } from '../engines/avatar/avatar-generation-job.entity';
import { VoiceProfile } from '../engines/avatar/voice-profile.entity';
import { AvatarProfile } from '../engines/avatar/avatar-profile.entity';
import { SetupDigitalTwinDto } from './dto/setup-digital-twin.dto';
import { GenerateFromPromptDto } from './dto/generate-from-prompt.dto';

/**
 * DigitalTwinService — camada de CONVENIÊNCIA, não uma engine nova.
 *
 * Reaproveita 100% do que já existe e já é testado:
 *   • AvatarOrchestratorService (voz clonada MiniMax + rosto Kling + lip-sync)
 *   • ScriptGeneratorService    (roteiro/copy gerado por LLM — DeepSeek)
 *
 * O ÚNICO papel deste serviço é reduzir DUAS chamadas em UMA nos dois pontos
 * de atrito descritos no pedido original:
 *   1) setup()            → cloneVoice() + createAvatarProfile() numa tacada.
 *   2) generateFromPrompt() → acha a voz/rosto já prontos do tenant, gera o
 *      texto do roteiro (LLM) a partir de um tema livre, e entrega esse
 *      texto pronto para AvatarOrchestratorService.generateVideo() —
 *      exatamente como o fluxo B pedia: `{ tenant_id, prompt_tema }`.
 *
 * Nenhuma tabela nova. Nenhuma duplicação de client de provedor externo.
 */
@Injectable()
export class DigitalTwinService {
  private readonly logger = new Logger(DigitalTwinService.name);

  constructor(
    private readonly avatarOrchestrator: AvatarOrchestratorService,
    private readonly scriptGenerator: ScriptGeneratorService,
  ) {}

  // ─── Fluxo A — Onboarding único ─────────────────────────────────────────

  async setup(dto: SetupDigitalTwinDto): Promise<{ voice_profile: VoiceProfile; avatar_profile: AvatarProfile }> {
    // As duas chamadas são independentes (voz na MiniMax, rosto na Kling) —
    // rodam em paralelo para não pagar a latência das duas em série. Cada
    // uma já trata sua própria falha internamente (status FAILED no
    // profile, ver AvatarOrchestratorService), então um erro em uma não
    // derruba a outra.
    const [voiceProfile, avatarProfile] = await Promise.all([
      this.avatarOrchestrator.cloneVoice({
        tenant_id: dto.tenant_id,
        name: dto.name,
        source_asset_id: dto.voice_source_asset_id,
        consent_record_id: dto.voice_consent_record_id,
      }),
      this.avatarOrchestrator.createAvatarProfile({
        tenant_id: dto.tenant_id,
        name: dto.name,
        source_asset_id: dto.avatar_source_asset_id,
        consent_record_id: dto.face_consent_record_id,
      }),
    ]);

    this.logger.log(
      `digital_twin setup: tenant=${dto.tenant_id} voice_profile=${voiceProfile.id}(${voiceProfile.status}) avatar_profile=${avatarProfile.id}(${avatarProfile.status})`,
    );

    return { voice_profile: voiceProfile, avatar_profile: avatarProfile };
  }

  // ─── Fluxo B — Geração por prompt simples ──────────────────────────────

  async generateFromPrompt(dto: GenerateFromPromptDto): Promise<AvatarGenerationJob> {
    // 1) Busca a identidade já cadastrada (setup feito antes) — sem isso, é
    //    o próprio DigitalTwinModule instruindo o cliente a rodar /setup,
    //    em vez de um erro genérico de "profile não encontrado".
    const [voiceProfile, avatarProfile] = await Promise.all([
      this.avatarOrchestrator.findLatestReadyVoiceProfile(dto.tenant_id),
      this.avatarOrchestrator.findLatestReadyAvatarProfile(dto.tenant_id),
    ]);

    if (!voiceProfile) {
      throw new BadRequestException(
        `Tenant ${dto.tenant_id} não tem nenhum voice_profile pronto (status READY). Rode POST /api/v1/digital-twin/setup antes.`,
      );
    }
    if (!avatarProfile) {
      throw new BadRequestException(
        `Tenant ${dto.tenant_id} não tem nenhum avatar_profile pronto (status READY). Rode POST /api/v1/digital-twin/setup antes.`,
      );
    }

    // 2) LLM (DeepSeek, via ScriptGeneratorService) transforma o tema livre
    //    num roteiro estruturado — reaproveita a MESMA peça que já serve
    //    `POST /api/v1/creative/script-generator`, sem duplicar prompt nem
    //    contrato JSON.
    const script = await this.scriptGenerator.generate({
      tenant_id: dto.tenant_id,
      brief: dto.prompt_tema,
      niche: dto.niche,
      platform: dto.platform,
      target_duration_seconds: dto.target_duration_seconds,
    });

    const scriptText = this.flattenScriptToNarration(script.contract as unknown as ScriptContract);

    // 3) Entrega para o pipeline de voz+avatar já existente — mesmo método,
    //    mesmo job assíncrono (202), mesmo webhook de resultado.
    const job = await this.avatarOrchestrator.generateVideo({
      tenant_id: dto.tenant_id,
      avatar_profile_id: avatarProfile.id,
      voice_profile_id: voiceProfile.id,
      script_text: scriptText,
      aspect_ratio: dto.aspect_ratio ?? '9:16',
    });

    this.logger.log(`digital_twin generate-video: tenant=${dto.tenant_id} script=${script.id} job=${job.id}(${job.status})`);
    return job;
  }

  /**
   * Achata o contrato estruturado do ScriptGeneratorService (hook + segmentos
   * do roteiro + cta) num texto corrido, na ordem certa para narração —
   * `legenda_social`/`hashtags`/`titulos_alternativos` ficam de fora de
   * propósito (são para o post, não para a fala do avatar).
   */
  private flattenScriptToNarration(contract: ScriptContract): string {
    const parts = [contract.hook, ...contract.roteiro.map((segment) => segment.text), contract.cta].filter(Boolean);
    return parts.join(' ');
  }
}
