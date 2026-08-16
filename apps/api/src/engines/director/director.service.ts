import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BrandKitsService } from '../../brand/brand-kits.service';
import { ScriptGeneratorService, ScriptContract } from '../../creative/script-generator/script-generator.service';
import { AiOrchestratorService } from '../m8/ai-orchestrator/ai-orchestrator.service';
import { QuotaExceededException } from '../../common/exceptions/quota-exceeded.exception';
import { ProjectSession } from './project-session.entity';
import { BusinessTicket } from './business-ticket.entity';
import { StrategyBrief } from './strategy-brief.entity';
import { CreativeManifest } from './creative-manifest.entity';
import { ProductionContract } from './production-contract.entity';
import { CreateSessionDto } from './dto/create-session.dto';
import { AdvanceBusinessDto } from './dto/advance-business.dto';
import { AdvanceStrategyDto } from './dto/advance-strategy.dto';
import { AdvanceCreativeDto } from './dto/advance-creative.dto';
import { AdvanceProductionDto } from './dto/advance-production.dto';

/** Score mínimo (0-100) pra Business Engine deixar a sessão avançar em vez de ABORTAR. */
const VIABILITY_THRESHOLD = 50;

/**
 * Director Engine — orquestrador de sessão de produção (CREATED → BUSINESS →
 * STRATEGY → CREATIVE → PRODUCTION).
 *
 * Decisão de design: em vez de reimplementar geração de conteúdo, este
 * serviço orquestra módulos que já existem e já são testados —
 * `BrandKitsService` (identidade visual) e `ScriptGeneratorService`
 * (LLM → roteiro). O Director Engine adiciona a máquina de estágios e a
 * decisão de negócio de cada um.
 */
@Injectable()
export class DirectorService {
  private readonly logger = new Logger(DirectorService.name);

  constructor(
    @InjectRepository(ProjectSession) private readonly sessions: Repository<ProjectSession>,
    @InjectRepository(BusinessTicket) private readonly businessTickets: Repository<BusinessTicket>,
    @InjectRepository(StrategyBrief) private readonly strategyBriefs: Repository<StrategyBrief>,
    @InjectRepository(CreativeManifest) private readonly creativeManifests: Repository<CreativeManifest>,
    @InjectRepository(ProductionContract) private readonly productionContracts: Repository<ProductionContract>,
    private readonly brandKits: BrandKitsService,
    private readonly scriptGenerator: ScriptGeneratorService,
    private readonly aiOrchestrator: AiOrchestratorService,
  ) {}

  // ─── Consulta ────────────────────────────────────────────────────────────

  /**
   * `tenantId` é obrigatório e é a fonte de isolamento em si — filtra a
   * busca no banco, não é uma checagem posterior. Sem isso, qualquer
   * chamador que soubesse o UUID de uma sessão de outro tenant conseguiria
   * lê-la (ver auditoria de isolamento multi-tenant).
   */
  async findOneOrFail(id: string, tenantId: string): Promise<ProjectSession> {
    const session = await this.sessions.findOne({ where: { id, tenant_id: tenantId } });
    if (!session) throw new NotFoundException(`Sessão ${id} não encontrada.`);
    return session;
  }

  findByTenant(tenantId: string): Promise<ProjectSession[]> {
    return this.sessions.find({ where: { tenant_id: tenantId }, order: { created_at: 'DESC' } });
  }

  /**
   * Contrato de produção mais recente da sessão — usado pelo frontend pra
   * descobrir o `ai_generation_job_id` a consultar em
   * `GET /api/v1/engines/m8/ai-video/:id` e acompanhar o progresso da
   * geração real disparada por `advanceProduction`.
   */
  async findProductionContractBySession(sessionId: string, tenantId: string): Promise<ProductionContract> {
    const contract = await this.productionContracts.findOne({
      where: { session_id: sessionId, tenant_id: tenantId },
      order: { created_at: 'DESC' },
    });
    if (!contract) throw new NotFoundException(`Sessão ${sessionId} ainda não tem contrato de produção.`);
    return contract;
  }

  /**
   * Status de render pro polling do frontend — traduz o `ai_generation_job`
   * vinculado ao contrato mais recente da sessão pro que a UI precisa
   * mostrar, sem expor a tabela interna diretamente. `tenantId` é
   * obrigatório e é a fonte de isolamento em si (mesmo racional de
   * `findOneOrFail`).
   */
  async getRenderStatus(
    sessionId: string,
    tenantId: string,
  ): Promise<{
    contractStatus: ProductionContract['status'];
    jobStatus: 'PENDING' | 'PROCESSING' | 'DONE' | 'FAILED' | null;
    finalAssetId: string | null;
    errorMessage: string | null;
  }> {
    const contract = await this.findProductionContractBySession(sessionId, tenantId);

    if (!contract.ai_generation_job_id) {
      return { contractStatus: contract.status, jobStatus: null, finalAssetId: null, errorMessage: null };
    }

    const job = await this.aiOrchestrator.findOneOrFail(contract.ai_generation_job_id, tenantId);

    return {
      contractStatus: contract.status,
      jobStatus: job.status,
      finalAssetId: job.final_asset_id,
      errorMessage: job.error_message,
    };
  }

  // ─── Criação ─────────────────────────────────────────────────────────────

  /** tenant_id é SEMPRE derivado do brand kit — nunca aceito diretamente do cliente (isolamento de tenant). `dto.tenantId` só confere que o chamador é dono desse brand. */
  async createSession(dto: CreateSessionDto): Promise<ProjectSession> {
    const brand = await this.brandKits.findOneOrFail(dto.brandId, dto.tenantId);

    const session = this.sessions.create({
      tenant_id: brand.tenant_id,
      brand_id: brand.id,
      current_stage: 'CREATED',
    });
    return this.sessions.save(session);
  }

  // ─── Estágio 1: Business Engine ─────────────────────────────────────────

  /**
   * "Vale a pena produzir isso?" — score determinístico (não usa LLM: é uma
   * checagem de completude/especificidade do problema, propositalmente
   * simples e auditável, não uma opinião de modelo). Regra explicada na UI
   * (`real-pipeline-panel.tsx`): "Sem meta mensurável e descrição curta, o
   * motor pode decidir ABORT — é uma regra real, não decoração."
   */
  private scoreBusinessTicket(dto: AdvanceBusinessDto): number {
    let score = 0;
    score += dto.problemDescription.trim().length >= 30 ? 40 : 10;
    score += dto.targetMetric.trim().length > 0 ? 30 : 0;
    score += dto.targetValue?.trim() ? 15 : 0;
    score += dto.currentValue?.trim() ? 15 : 0;
    return Math.min(score, 100);
  }

  async advanceBusiness(sessionId: string, dto: AdvanceBusinessDto): Promise<ProjectSession> {
    const session = await this.findOneOrFail(sessionId, dto.tenantId);
    this.assertStage(session, 'CREATED');
    if (session.brand_id !== dto.brandId) {
      throw new BadRequestException('brandId não corresponde à marca da sessão.');
    }

    const score = this.scoreBusinessTicket(dto);

    if (score < VIABILITY_THRESHOLD) {
      session.current_stage = 'ABORTED';
      session.abort_reason =
        `Business Engine: score de viabilidade ${score}/100 (mínimo ${VIABILITY_THRESHOLD}). ` +
        'Descrição do problema muito curta ou meta de sucesso não informada — detalhe mais antes de tentar de novo.';
      return this.sessions.save(session);
    }

    const ticket = await this.businessTickets.save(
      this.businessTickets.create({
        session_id: session.id,
        tenant_id: session.tenant_id,
        brand_id: session.brand_id,
        problem_category: dto.problemCategory,
        problem_description: dto.problemDescription,
        target_metric: dto.targetMetric,
        current_value: dto.currentValue ?? null,
        target_value: dto.targetValue ?? null,
        viability_score: score,
      }),
    );

    session.business_ticket_id = ticket.id;
    session.current_stage = 'BUSINESS';
    return this.sessions.save(session);
  }

  // ─── Estágio 2: Strategy Engine ─────────────────────────────────────────

  /**
   * Sem rejeição automática aqui — diferente do Business Engine, os campos
   * já chegam estruturados e fechados em enum pelo frontend (Algoritmo de
   * Conflito Triplo: desejo manifesto × medo oculto × contradição cultural).
   * O motor persiste e sequencia.
   */
  async advanceStrategy(sessionId: string, dto: AdvanceStrategyDto): Promise<ProjectSession> {
    const session = await this.findOneOrFail(sessionId, dto.tenantId);
    this.assertStage(session, 'BUSINESS');
    if (session.business_ticket_id !== dto.businessTicketId) {
      throw new BadRequestException('businessTicketId não corresponde ao ticket desta sessão.');
    }

    const brief = await this.strategyBriefs.save(
      this.strategyBriefs.create({
        session_id: session.id,
        tenant_id: session.tenant_id,
        business_ticket_id: dto.businessTicketId,
        target_audience: dto.targetAudience,
        core_thesis: dto.coreThesis,
        angle: dto.angle,
        psychological_approach: dto.psychologicalApproach,
        primary_channel: dto.primaryChannel,
        desired_emotion: dto.desiredEmotion,
        call_to_action_type: dto.callToActionType,
        tone_of_voice: dto.toneOfVoice ?? null,
      }),
    );

    session.strategy_brief_id = brief.id;
    session.current_stage = 'STRATEGY';
    return this.sessions.save(session);
  }

  // ─── Estágio 3: Creative Engine ─────────────────────────────────────────

  /** Canal → plataforma suportada por ScriptGeneratorService. LINKEDIN_VIDEO não tem equivalente direto; cai pro formato reels mais próximo. */
  private mapChannelToPlatform(channel: StrategyBrief['primary_channel']): 'instagram_reels' | 'tiktok' | 'youtube_shorts' {
    switch (channel) {
      case 'TIKTOK':
        return 'tiktok';
      case 'YOUTUBE_SHORTS':
        return 'youtube_shorts';
      case 'INSTAGRAM_REELS':
      case 'LINKEDIN_VIDEO':
      default:
        return 'instagram_reels';
    }
  }

  /**
   * Traduz o StrategyBrief num briefing coeso pro ScriptGeneratorService —
   * NÃO chama o LLM diretamente aqui, reaproveita o serviço inteiro
   * (prompt/validação/persistência/tratamento de falha já existentes).
   */
  private buildBriefFromStrategy(brief: StrategyBrief): string {
    const audience = brief.target_audience;
    return [
      `Tese central: ${brief.core_thesis}`,
      `Público-alvo: desejo manifesto "${audience.manifestDesire}", medo oculto "${audience.hiddenFear}", contradição cultural "${audience.culturalContradiction}"`,
      `Ângulo de comunicação: ${brief.angle}`,
      `Abordagem psicológica: ${brief.psychological_approach}`,
      `Emoção-alvo: ${brief.desired_emotion}`,
      `Tipo de call-to-action: ${brief.call_to_action_type}`,
    ].join('\n');
  }

  async advanceCreative(sessionId: string, dto: AdvanceCreativeDto): Promise<ProjectSession> {
    const session = await this.findOneOrFail(sessionId, dto.tenantId);
    this.assertStage(session, 'STRATEGY');
    if (!session.strategy_brief_id) {
      throw new ConflictException('Sessão sem strategy_brief_id — estado inconsistente.');
    }

    const brief = await this.strategyBriefs.findOne({
      where: { id: session.strategy_brief_id, tenant_id: session.tenant_id },
    });
    if (!brief) throw new NotFoundException(`Strategy brief ${session.strategy_brief_id} não encontrado.`);

    const script = await this.scriptGenerator.generate({
      tenant_id: session.tenant_id,
      brief: this.buildBriefFromStrategy(brief),
      niche: 'escritorio', // sem niche explícito no fluxo Director — ver nota de limitação no README do módulo
      platform: this.mapChannelToPlatform(brief.primary_channel),
      tone_of_voice: brief.tone_of_voice ?? undefined,
    });

    const manifest = await this.creativeManifests.save(
      this.creativeManifests.create({
        session_id: session.id,
        tenant_id: session.tenant_id,
        strategy_brief_id: brief.id,
        script_id: script.id,
        voice_id: dto.voiceId ?? null,
      }),
    );

    session.creative_manifest_id = manifest.id;
    session.current_stage = 'CREATIVE';
    return this.sessions.save(session);
  }

  // ─── Estágio 4: Creative → Production (dispara a geração real) ─────────

  /**
   * Traduz o ScriptContract (hook + roteiro por segmentos + cta) num prompt
   * de texto único pro Kling/MiniMax — os dois são modelos de
   * texto-pra-vídeo, então o roteiro inteiro (na ordem narrativa) vira a
   * descrição da cena a gerar.
   */
  private buildPromptFromScript(contract: ScriptContract): string {
    const segments = (contract.roteiro ?? []).map((s) => s.text).join(' ');
    return [contract.hook, segments, contract.cta].filter(Boolean).join(' ');
  }

  /**
   * Dispara a geração real de vídeo via `AiOrchestratorService` (Kling
   * primário, MiniMax fallback), usando o roteiro do Creative Manifest como
   * prompt e a paleta do Brand Kit da sessão como contexto visual. Mesmo
   * pipeline assíncrono de `POST /api/v1/engines/m8/ai-video`: o contrato
   * de produção fica com `status: 'GENERATING'` e `ai_generation_job_id`
   * apontando pro job real, consultável em
   * `GET /api/v1/engines/m8/ai-video/:id` até chegar em DONE/FAILED via
   * webhook do provedor.
   *
   * `AiOrchestratorService.submit()` nunca lança exceção por falha do
   * provedor em si (ela fica registrada no próprio job, `status: 'FAILED'`,
   * com estorno automático de cota — ver `AiOrchestratorService.markFailed`)
   * — só lança em duas situações antes mesmo de tentar Kling/MiniMax:
   * tenant não encontrado (não deveria acontecer aqui, `session.tenant_id`
   * já validado na criação da sessão) ou `QuotaExceededException` (BLINDAGEM
   * FINANCEIRA: tenant sem cota mensal nem crédito avulso — ver
   * `AiOrchestratorService.submit()`, que debita a cota ANTES de qualquer
   * chamada paga).
   *
   * `QuotaExceededException` é DELIBERADAMENTE relançada (não vira
   * `DISPATCH_FAILED` genérico): o estágio da sessão NÃO avança pra
   * PRODUCTION, o contrato de produção criado é removido, e o chamador
   * recebe 402 de verdade — o usuário deve poder tentar de novo (mesma
   * sessão, ainda em CREATIVE) assim que comprar crédito/fizer upgrade, em
   * vez de ficar com uma sessão travada em PRODUCTION/DISPATCH_FAILED sem
   * ter sido cobrado. Qualquer outra falha (rede, provedor indisponível
   * antes mesmo de criar o job) cai no catch genérico abaixo: aí sim o
   * estágio avança e fica visível como DISPATCH_FAILED, pois a cota JÁ foi
   * debitada nesse caso (a falha é depois do débito).
   */
  async advanceProduction(sessionId: string, dto: AdvanceProductionDto): Promise<ProjectSession> {
    const session = await this.findOneOrFail(sessionId, dto.tenantId);
    this.assertStage(session, 'CREATIVE');
    if (!session.creative_manifest_id) {
      throw new ConflictException('Sessão sem creative_manifest_id — estado inconsistente.');
    }

    const manifest = await this.creativeManifests.findOne({
      where: { id: session.creative_manifest_id, tenant_id: session.tenant_id },
    });
    if (!manifest) throw new NotFoundException(`Creative manifest ${session.creative_manifest_id} não encontrado.`);

    const script = await this.scriptGenerator.findOneOrFail(manifest.script_id, session.tenant_id);
    if (script.status !== 'DONE') {
      throw new ConflictException(
        `Roteiro ${script.id} está com status '${script.status}' — só é possível avançar pra produção com um roteiro concluído.`,
      );
    }

    const brand = await this.brandKits.findOneOrFail(session.brand_id, session.tenant_id);

    const contract = await this.productionContracts.save(
      this.productionContracts.create({
        session_id: session.id,
        tenant_id: session.tenant_id,
        brand_id: session.brand_id,
        creative_manifest_id: manifest.id,
        script_id: manifest.script_id,
        status: 'READY',
      }),
    );

    try {
      const job = await this.aiOrchestrator.submit({
        tenant_id: session.tenant_id,
        prompt: this.buildPromptFromScript(script.contract as unknown as ScriptContract),
        aspect_ratio: dto.aspectRatio ?? '9:16',
        brand_kit: { palette: brand.palette },
      });
      contract.ai_generation_job_id = job.id;
      contract.status = 'GENERATING';
    } catch (err) {
      if (err instanceof QuotaExceededException) {
        // Nada foi debitado, nenhuma chamada paga foi feita — desfaz o
        // contrato 'READY' que criamos acima e deixa a sessão em CREATIVE,
        // pronta pra tentar de novo depois que o tenant resolver a cota.
        await this.productionContracts.delete({ id: contract.id });
        this.logger.warn(`Sessão ${session.id}: produção bloqueada por cota esgotada (tenant ${session.tenant_id}).`);
        throw err;
      }
      // Falha de infraestrutura antes mesmo de criar o job (ex.: tenant não
      // encontrado) — falha do provedor Kling/MiniMax em si já vem com
      // estorno automático e fica registrada no próprio job (ver
      // `AiOrchestratorService.markFailed`).
      this.logger.error(`Falha ao disparar geração de vídeo pra sessão ${session.id}: ${(err as Error).message}`);
      contract.status = 'DISPATCH_FAILED';
    }
    await this.productionContracts.save(contract);

    session.render_job_id = contract.id;
    session.current_stage = 'PRODUCTION';
    return this.sessions.save(session);
  }

  // ─── Helper ──────────────────────────────────────────────────────────────

  private assertStage(session: ProjectSession, expected: ProjectSession['current_stage']): void {
    if (session.current_stage !== expected) {
      throw new ConflictException(
        `Sessão está em '${session.current_stage}', esperado '${expected}' pra este avanço.`,
      );
    }
  }
}
