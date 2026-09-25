import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { RedisService } from '../../common/redis/redis.service';
import { AiOrchestratorService } from '../../engines/m8/ai-orchestrator/ai-orchestrator.service';
import { LlmClientService } from '../llm/llm-client.service';
import { CreateGenerationDto, PromptOptimizeDto } from './dto/prompt-optimize.dto';

export interface PromptOptimization {
  id: string;
  /** 'deepseek' quando o LLM respondeu; 'local' quando caiu no fallback determinístico (LLM ausente/falhou). */
  provider: 'deepseek' | 'local';
  cacheHit?: boolean;
  title: string;
  objective: string;
  audience: string;
  coreMessage: string;
  visualDirection: string;
  voiceoverText: string;
  shotList: string[];
  negativePrompt: string;
  optimizedPrompt: string;
  preservationRules: string[];
  note?: string;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_VIDEO_PROMPT_CHARS = 4000;

const SYSTEM_PROMPT = [
  'Você é diretor de criação de uma agência brasileira especializada em anúncios curtos para pequenos negócios.',
  'Recebe um briefing escrito de forma livre (pode ter erros de digitação) e devolve um briefing corrigido e estruturado',
  'para um gerador de vídeo por IA. Preserve fielmente a oferta, preços, nomes, datas e promessas do cliente — nunca invente',
  'descontos, números ou garantias que não estejam no texto. Escreva em português do Brasil.',
  'Formato de saída (JSON): {"title": string curto, "objective": string, "audience": string, "coreMessage": string,',
  '"visualDirection": string, "voiceoverText": string (narração de até 30s), "shotList": string[] (3 a 6 cenas),',
  '"negativePrompt": string (o que evitar na imagem), "optimizedPrompt": string (prompt final para o gerador de vídeo,',
  'descritivo, até 1200 caracteres), "preservationRules": string[] (fatos do briefing que não podem mudar)}.',
].join(' ');

/**
 * Briefing do Estúdio (components/studio/briefing-composer.tsx):
 *  1. `optimize` — corrige/estrutura o texto livre do usuário via LLM
 *     (DeepSeek, LlmClientService), com cache Redis por conteúdo (24h) para
 *     não pagar de novo pelo mesmo briefing. Sem LLM configurado (ou se ele
 *     falhar), cai para uma estruturação local determinística — o fluxo
 *     nunca trava por falta de chave.
 *  2. `createGeneration` — dispara o vídeo real pelo AiOrchestratorService
 *     (mesmo caminho de POST /api/v1/engines/m8/ai-video/generate: debita
 *     cota, Kling → MiniMax, 202 + webhook), usando o prompt otimizado.
 *
 * Isolamento: a otimização guardada no Redis carrega o tenantId de quem a
 * criou; `createGeneration` só aceita uma otimização do próprio tenant.
 */
@Injectable()
export class BriefingService {
  private readonly logger = new Logger(BriefingService.name);

  constructor(
    private readonly llm: LlmClientService,
    private readonly redis: RedisService,
    private readonly orchestrator: AiOrchestratorService,
  ) {}

  async optimize(tenantId: string, dto: PromptOptimizeDto): Promise<PromptOptimization> {
    const contentKey = createHash('sha256')
      .update(
        JSON.stringify({
          p: dto.prompt.trim(),
          a: dto.aspectRatio,
          t: dto.tone ?? '',
          r: dto.references ?? [],
          b: dto.brandContext ?? {},
        }),
      )
      .digest('hex');
    const cacheKey = `ai:prompt-opt:cache:${tenantId}:${contentKey}`;

    const cachedId = await this.redis.get(cacheKey);
    if (cachedId) {
      const cached = await this.load(tenantId, cachedId);
      if (cached) return { ...cached, cacheHit: true };
    }

    const result = await this.optimizeWithLlm(dto).catch((err: unknown) => {
      this.logger.warn(`Otimização via LLM falhou, usando fallback local: ${(err as Error).message}`);
      return null;
    });
    const optimization: PromptOptimization = result ?? this.localOptimization(dto);

    await this.redis.setWithTtlMs(
      `ai:prompt-opt:item:${optimization.id}`,
      JSON.stringify({ tenantId, optimization }),
      CACHE_TTL_MS,
    );
    await this.redis.setWithTtlMs(cacheKey, optimization.id, CACHE_TTL_MS);
    return { ...optimization, cacheHit: false };
  }

  async createGeneration(tenantId: string, dto: CreateGenerationDto) {
    const optimization = await this.load(tenantId, dto.optimizationId);
    if (!optimization) {
      throw new NotFoundException('Briefing otimizado não encontrado ou expirado. Envie o briefing novamente.');
    }
    const palette = dto.brandContext?.palette?.filter(Boolean) ?? [];
    return this.orchestrator.submit({
      tenant_id: tenantId,
      prompt: optimization.optimizedPrompt.slice(0, MAX_VIDEO_PROMPT_CHARS),
      // O gerador de vídeo aceita 9:16 / 16:9 / 1:1 — feed 4:5 sai em 1:1.
      aspect_ratio: dto.aspectRatio === '4:5' ? '1:1' : dto.aspectRatio,
      ...(palette.length > 0 ? { brand_kit: { palette } } : {}),
    });
  }

  private async load(tenantId: string, id: string): Promise<PromptOptimization | null> {
    const raw = await this.redis.get(`ai:prompt-opt:item:${id}`);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as { tenantId: string; optimization: PromptOptimization };
      return parsed.tenantId === tenantId ? parsed.optimization : null;
    } catch {
      return null;
    }
  }

  private async optimizeWithLlm(dto: PromptOptimizeDto): Promise<PromptOptimization | null> {
    if (!this.llm.isConfigured) return null;

    const context = [
      `Briefing do cliente: """${dto.prompt.trim()}"""`,
      `Formato: ${dto.formatId ?? 'reel'} (${dto.aspectRatio})`,
      dto.tone ? `Tom desejado: ${dto.tone}` : '',
      dto.brandContext?.name ? `Marca: ${dto.brandContext.name}` : '',
      dto.brandContext?.palette?.length ? `Paleta da marca: ${dto.brandContext.palette.join(', ')}` : '',
      dto.references?.length ? `Materiais de referência enviados: ${dto.references.join('; ')}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const raw = await this.llm.completeJson<Partial<PromptOptimization>>({
      system: SYSTEM_PROMPT,
      prompt: context,
      maxTokens: 1500,
      temperature: 0.4,
    });

    const optimizedPrompt = str(raw.optimizedPrompt);
    if (!optimizedPrompt) throw new Error('resposta sem optimizedPrompt');

    return {
      id: randomUUID(),
      provider: 'deepseek',
      title: str(raw.title) || 'Briefing otimizado',
      objective: str(raw.objective),
      audience: str(raw.audience),
      coreMessage: str(raw.coreMessage),
      visualDirection: str(raw.visualDirection),
      voiceoverText: str(raw.voiceoverText),
      shotList: strList(raw.shotList),
      negativePrompt: str(raw.negativePrompt),
      optimizedPrompt,
      preservationRules: strList(raw.preservationRules),
    };
  }

  /** Estruturação determinística sem LLM — mantém o texto do cliente intacto e só acrescenta direção técnica. */
  private localOptimization(dto: PromptOptimizeDto): PromptOptimization {
    const brief = dto.prompt.trim().replace(/\s+/g, ' ');
    const firstSentence = brief.split(/(?<=[.!?])\s/)[0] ?? brief;
    const tone = dto.tone ?? 'profissional';
    const palette = dto.brandContext?.palette?.length ? ` Paleta de cores: ${dto.brandContext.palette.join(', ')}.` : '';
    const brand = dto.brandContext?.name ? ` Marca: ${dto.brandContext.name}.` : '';
    const visualDirection = `Vídeo publicitário ${dto.aspectRatio}, iluminação natural, cortes dinâmicos, tom ${tone}.${palette}`;

    return {
      id: randomUUID(),
      provider: 'local',
      title: firstSentence.slice(0, 80),
      objective: 'Divulgar a oferta descrita pelo cliente e gerar contato.',
      audience: 'Clientes em potencial do negócio no Instagram.',
      coreMessage: firstSentence,
      visualDirection,
      voiceoverText: brief.slice(0, 400),
      shotList: ['Abertura com gancho visual do produto/serviço', 'Destaque da oferta', 'Chamada para ação final'],
      negativePrompt: 'texto ilegível, marcas d’água, rostos distorcidos, baixa resolução',
      optimizedPrompt: `${brief}${brand} ${visualDirection}`.slice(0, 1200),
      preservationRules: ['Manter a oferta, preços e nomes exatamente como descritos pelo cliente.'],
      note: 'Estruturado localmente (LLM indisponível no momento).',
    };
  }
}

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function strList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string' && v.trim() !== '').map((v) => v.trim()) : [];
}
