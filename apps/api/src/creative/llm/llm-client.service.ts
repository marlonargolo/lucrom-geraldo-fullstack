import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Cliente HTTP para a DeepSeek Platform API (`/chat/completions`, formato
 * compatível com OpenAI), no mesmo espírito do ReplicateClientService
 * (engines/m8/replicate-client.service.ts): sem SDK extra, só fetch nativo
 * do Node 20, com retries estruturados.
 *
 * MIGRAÇÃO (registrada na conversa que precedeu esta implementação): este
 * cliente falava com a Anthropic Messages API; foi migrado para a DeepSeek
 * porque o requisito de produto passou a ser "somente APIs pagas chinesas"
 * em toda a stack de IA generativa — o mesmo critério que já levou o
 * projeto a usar MiniMax (voz) e Kling (avatar/lip-sync) em vez de
 * ElevenLabs/HeyGen. A DeepSeek entrega qualidade comparável para geração
 * de roteiro/copy a uma fração do custo por token (ver comparativo de
 * pricing discutido fora do código).
 *
 * A interface pública (`complete`, `completeJson`, `isConfigured`) foi
 * MANTIDA IDÊNTICA de propósito — nenhum consumidor precisou mudar:
 *   • ScriptGeneratorService — gera o contrato JSON de roteiro/copy (Lacuna 1).
 *   • VoiceCommandService    — interpreta o texto transcrito pelo WhisperX e
 *     o converte num "intent" estruturado (Lacuna 3).
 *   • DigitalTwinService     — gera o texto de narração a partir do prompt_tema.
 *
 * Cache de contexto: a DeepSeek faz cache automático em disco de qualquer
 * prefixo repetido entre chamadas (ex.: o mesmo system prompt de nicho
 * enviado várias vezes) — cache HIT chega a custar ~1/10 a ~1/100 do preço
 * de input normal, SEM precisar de nenhum header especial (diferente do
 * `anthropic-beta: prompt-caching` que a API da Anthropic exige). Por isso
 * não há nenhum header de cache manual aqui: o ganho de custo já é
 * automático, desde que o mesmo texto de `system` seja reaproveitado entre
 * chamadas (é isso que ScriptGeneratorService/DigitalTwinService já fazem,
 * ao montar o system prompt de nicho sempre da mesma forma).
 *
 * Suporta apenas saída em JSON quando `expectJson` é usado — o prompt do
 * caller deve instruir o modelo a responder SOMENTE com JSON (sem markdown),
 * e este cliente faz um parse defensivo (remove blocos ```json se vierem).
 */
@Injectable()
export class LlmClientService {
  private readonly logger = new Logger(LlmClientService.name);
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;
  private readonly maxRetries = 2;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('llm.apiKey') ?? '';
    this.model = this.config.get<string>('llm.model') ?? 'deepseek-chat';
    this.baseUrl = this.config.get<string>('llm.baseUrl') ?? 'https://api.deepseek.com/chat/completions';

    if (!this.apiKey) {
      this.logger.warn('LLM_API_KEY não configurado — ScriptGeneratorService, DigitalTwinModule e a interpretação de comandos de voz estarão desabilitados.');
    }
  }

  get isConfigured(): boolean {
    return !!this.apiKey;
  }

  /**
   * Envia um prompt de usuário (mais um system prompt opcional) e retorna o
   * texto bruto da resposta do modelo.
   */
  async complete(params: { system?: string; prompt: string; maxTokens?: number; temperature?: number }): Promise<string> {
    if (!this.apiKey) throw new Error('LLM_API_KEY não configurado.');

    const messages: Array<{ role: 'system' | 'user'; content: string }> = [];
    if (params.system) messages.push({ role: 'system', content: params.system });
    messages.push({ role: 'user', content: params.prompt });

    const body = {
      model: this.model,
      max_tokens: params.maxTokens ?? 2048,
      temperature: params.temperature ?? 0.7,
      messages,
    };

    let lastError: unknown;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const res = await fetch(this.baseUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const errText = await res.text();
          if ((res.status === 429 || res.status >= 500) && attempt < this.maxRetries) {
            const waitMs = 400 * Math.pow(2, attempt);
            this.logger.warn(`LLM HTTP ${res.status} (tentativa ${attempt + 1}) — aguardando ${waitMs}ms.`);
            await sleep(waitMs);
            continue;
          }
          throw new Error(`LLM request falhou (${res.status}): ${errText}`);
        }

        // Formato OpenAI-compatible: choices[0].message.content (string).
        const data: { choices?: Array<{ message?: { content?: string } }> } = (await res.json()) as any;
        const text = data.choices?.[0]?.message?.content ?? '';
        return text;
      } catch (err) {
        lastError = err;
        if (attempt < this.maxRetries) {
          await sleep(400 * Math.pow(2, attempt));
          continue;
        }
      }
    }
    throw lastError ?? new Error('LLM request falhou após retries.');
  }

  /**
   * Igual a `complete`, mas instrui o modelo a responder SOMENTE em JSON e já
   * faz o parse. Lança erro se o modelo não retornar JSON válido.
   */
  async completeJson<T = unknown>(params: { system?: string; prompt: string; maxTokens?: number; temperature?: number }): Promise<T> {
    const jsonSystem = [
      params.system ?? '',
      'Responda ESTRITAMENTE com um objeto JSON válido, sem markdown, sem ```json, sem texto antes ou depois.',
    ]
      .filter(Boolean)
      .join('\n\n');

    const raw = await this.complete({ ...params, system: jsonSystem });
    const cleaned = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
    try {
      return JSON.parse(cleaned) as T;
    } catch (err) {
      throw new Error(`LLM não retornou JSON válido: ${(err as Error).message}. Resposta bruta: ${cleaned.slice(0, 500)}`);
    }
  }
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}
