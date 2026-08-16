import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from '../../tenants/tenant.entity';
import { LlmClientService } from '../llm/llm-client.service';
import { Script } from './script.entity';
import { GenerateScriptDto } from './dto/generate-script.dto';

/**
 * Contrato JSON de saída do roteiro/copy — consumido depois por:
 *   • `render_jobs.script_id` (Blueprint Vol.3 §2) — o `roteiro[]` vira a
 *     base do `script_text` usado pelos Audit Gates (Gate 1/3, TOM_ROTEIRO).
 *   • GraphicComposerService — `hook`/`cta` podem virar título/rodapé de artes.
 */
export interface ScriptSegment {
  /** Papel do segmento na narrativa (ex.: 'hook', 'desenvolvimento', 'prova_social', 'cta'). */
  segment: string;
  text: string;
  duration_seconds_estimate: number;
}

export interface ScriptContract {
  hook: string;
  roteiro: ScriptSegment[];
  cta: string;
  legenda_social: string;
  hashtags: string[];
  titulos_alternativos: string[];
}

const NICHE_TONE_HINTS: Record<string, string> = {
  marcenaria: 'caloroso, artesanal, orgulho do fazer manual',
  farmacia: 'confiável, acolhedor, claro sobre cuidado e saúde',
  mercado: 'energético, apetitoso, urgência gastronômica',
  escritorio: 'profissional, direto, foco em eficiência e resultado',
};

@Injectable()
export class ScriptGeneratorService {
  private readonly logger = new Logger(ScriptGeneratorService.name);

  constructor(
    @InjectRepository(Script) private readonly scripts: Repository<Script>,
    @InjectRepository(Tenant) private readonly tenants: Repository<Tenant>,
    private readonly llm: LlmClientService,
  ) {}

  async generate(dto: GenerateScriptDto): Promise<Script> {
    if (!this.llm.isConfigured) {
      throw new ServiceUnavailableException('LLM_API_KEY não configurado — ScriptGeneratorService está desabilitado.');
    }

    const tenant = await this.tenants.findOne({ where: { id: dto.tenant_id } });
    if (!tenant) throw new BadRequestException(`Tenant ${dto.tenant_id} não encontrado.`);

    const prompt = this.buildPrompt(dto);

    let contract: ScriptContract;
    try {
      contract = await this.llm.completeJson<ScriptContract>({
        system: this.buildSystemPrompt(),
        prompt,
        maxTokens: 2048,
        temperature: 0.8,
      });
      this.validateContract(contract);
    } catch (err) {
      const failed = this.scripts.create({
        tenant_id: dto.tenant_id,
        niche: dto.niche,
        platform: dto.platform,
        brief: dto.brief,
        contract: {},
        status: 'FAILED',
        error_message: (err as Error).message,
      });
      await this.scripts.save(failed);
      throw new BadRequestException(`Falha ao gerar roteiro: ${(err as Error).message}`);
    }

    const saved = this.scripts.create({
      tenant_id: dto.tenant_id,
      niche: dto.niche,
      platform: dto.platform,
      brief: dto.brief,
      contract: contract as unknown as Record<string, unknown>,
      status: 'DONE',
    });
    return this.scripts.save(saved);
  }

  findOneOrFail(id: string, tenantId: string) {
    return this.scripts.findOneOrFail({ where: { id, tenant_id: tenantId } });
  }

  findByTenant(tenantId: string) {
    return this.scripts.find({ where: { tenant_id: tenantId }, order: { created_at: 'DESC' } });
  }

  private buildSystemPrompt(): string {
    return (
      'Você é um roteirista/copywriter sênior especializado em vídeos curtos e posts para redes sociais ' +
      'de pequenos negócios brasileiros (marcenarias, farmácias, mercados/padarias e escritórios/serviços). ' +
      'Seu roteiro precisa ser natural para ser falado em vídeo (frases curtas, sem jargão), respeitar ' +
      'qualquer palavra proibida informada, e seguir exatamente o formato JSON pedido.'
    );
  }

  private buildPrompt(dto: GenerateScriptDto): string {
    const toneHint = dto.tone_of_voice ?? NICHE_TONE_HINTS[dto.niche] ?? 'natural e direto';
    const duration = dto.target_duration_seconds ?? 30;
    const forbidden = dto.forbidden_words?.length ? dto.forbidden_words.join(', ') : 'nenhuma';

    return [
      `Nicho: ${dto.niche}`,
      `Plataforma de destino: ${dto.platform}`,
      `Tom de voz: ${toneHint}`,
      `Duração alvo do vídeo: ${duration} segundos`,
      `Palavras/expressões proibidas: ${forbidden}`,
      '',
      `Briefing do cliente: """${dto.brief}"""`,
      '',
      'Gere um roteiro/copy completo respondendo SOMENTE com um objeto JSON no seguinte formato exato:',
      JSON.stringify(
        {
          hook: 'primeira frase, gancho que prende atenção nos 2 primeiros segundos',
          roteiro: [
            { segment: 'hook', text: '...', duration_seconds_estimate: 3 },
            { segment: 'desenvolvimento', text: '...', duration_seconds_estimate: 15 },
            { segment: 'prova_social_ou_diferencial', text: '...', duration_seconds_estimate: 7 },
            { segment: 'cta', text: '...', duration_seconds_estimate: 5 },
          ],
          cta: 'chamada para ação final, curta e clara',
          legenda_social: 'legenda pronta para publicar junto ao post/vídeo',
          hashtags: ['#exemplo1', '#exemplo2'],
          titulos_alternativos: ['Título A', 'Título B', 'Título C'],
        },
        null,
        2,
      ),
      '',
      'A soma de duration_seconds_estimate dos segmentos deve ficar próxima da duração alvo informada.',
    ].join('\n');
  }

  private validateContract(contract: ScriptContract): void {
    if (!contract || typeof contract !== 'object') throw new Error('Contrato vazio ou inválido.');
    if (!contract.hook || typeof contract.hook !== 'string') throw new Error('Campo "hook" ausente ou inválido.');
    if (!Array.isArray(contract.roteiro) || contract.roteiro.length === 0) {
      throw new Error('Campo "roteiro" ausente ou vazio.');
    }
    if (!contract.cta || typeof contract.cta !== 'string') throw new Error('Campo "cta" ausente ou inválido.');
    if (!Array.isArray(contract.hashtags)) throw new Error('Campo "hashtags" ausente ou inválido.');
  }
}
