import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Cliente HTTP para a Replicate Inference API.
 * Usado pelos serviços generativos: VideoMattingService (RVM),
 * AudioCleanService (WhisperX) e NichePresetService (Flux/IC-Light).
 *
 * Implementa a interface mínima que os serviços dependentes esperam:
 *   run(modelVersion, input)  — enfileira e aguarda o prediction
 *   toDataUri(buffer, mime)   — converte Buffer em data URI (base64)
 *   downloadOutput(url)       — baixa um artefato de saída para Buffer
 *
 * Não usa o SDK oficial do Replicate para manter zero dependências extras
 * além do Node.js 20 nativo (fetch está disponível globalmente).
 *
 * fetchWithRetry() aplica retries com backoff exponencial para erros
 * HTTP 5xx transitórios e falhas de rede.
 */
@Injectable()
export class ReplicateClientService {
  private readonly logger = new Logger(ReplicateClientService.name);
  private readonly apiToken: string;
  private readonly baseUrl = 'https://api.replicate.com/v1';

  /** Número máximo de tentativas para chamadas HTTP à API do Replicate. */
  private readonly maxRetries = 3;
  /** Base do backoff exponencial em ms (200 → 400 → 800 ms com jitter). */
  private readonly retryBaseMs = 200;

  constructor(private readonly config: ConfigService) {
    this.apiToken = this.config.get<string>('replicate.apiToken') ?? '';
    if (!this.apiToken) {
      this.logger.warn('REPLICATE_API_TOKEN não configurado — serviços generativos (RVM, WhisperX, Flux) estarão desabilitados.');
    }
  }

  /**
   * Executa um modelo no Replicate e aguarda a conclusão (polling).
   * Compatível com versões fixas ("owner/model:sha") e aliases ("owner/model").
   */
  async run(
    modelVersion: string,
    input: Record<string, unknown>,
    timeoutMs = 300_000,
  ): Promise<unknown> {
    if (!this.apiToken) throw new Error('REPLICATE_API_TOKEN não configurado.');

    // Cria o prediction
    const endpoint = modelVersion.includes(':')
      ? `${this.baseUrl}/predictions`
      : `${this.baseUrl}/models/${modelVersion}/predictions`;

    const body: Record<string, unknown> = { input };
    if (modelVersion.includes(':')) body.version = modelVersion.split(':')[1];

    const createRes = await this.fetchWithRetry(endpoint, {
      method: 'POST',
      headers: { Authorization: `Token ${this.apiToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!createRes.ok) {
      const err = await createRes.text();
      throw new Error(`Replicate create prediction falhou (${createRes.status}): ${err}`);
    }

    const prediction: { id: string; urls: { get: string }; status: string } =
      await createRes.json() as any;

    // Polling até completar ou dar timeout
    const deadline = Date.now() + timeoutMs;
    const pollUrl = prediction.urls.get;

    while (Date.now() < deadline) {
      await sleep(3000);
      const pollRes = await this.fetchWithRetry(pollUrl, {
        headers: { Authorization: `Token ${this.apiToken}` },
      });
      if (!pollRes.ok) throw new Error(`Replicate poll falhou (${pollRes.status})`);

      const poll: { status: string; output?: unknown; error?: string } = await pollRes.json() as any;

      if (poll.status === 'succeeded') {
        this.logger.debug(`Replicate prediction ${prediction.id} concluído.`);
        return poll.output;
      }
      if (poll.status === 'failed' || poll.status === 'canceled') {
        throw new Error(`Replicate prediction ${prediction.id} falhou: ${poll.error ?? poll.status}`);
      }
      this.logger.debug(`Replicate prediction ${prediction.id} status=${poll.status} — aguardando…`);
    }

    throw new Error(`Replicate prediction ${prediction.id} excedeu timeout de ${timeoutMs / 1000}s.`);
  }

  /** Converte um Buffer binário em data URI (base64) — aceito como input por modelos no Replicate. */
  toDataUri(buffer: Buffer, mimeType: string): string {
    return `data:${mimeType};base64,${buffer.toString('base64')}`;
  }

  /** Baixa um artefato de saída do Replicate (URL pré-assinada) para um Buffer local. */
  async downloadOutput(url: string): Promise<Buffer> {
    const res = await this.fetchWithRetry(url);
    if (!res.ok) {
      throw new Error(`Falha ao baixar output do Replicate (${res.status}): ${url}`);
    }
    const ab = await res.arrayBuffer();
    return Buffer.from(ab);
  }

  /**
   * Wrapper de fetch com retries estruturados e backoff exponencial com jitter.
   *
   * Retenta automaticamente em:
   *   • Erros de rede (TypeError/ECONNRESET/ETIMEDOUT)
   *   • Respostas HTTP 429 (rate-limit) e 5xx (erros transitórios do servidor)
   *
   * Não retenta em 4xx (exceto 429) pois indicam erros do cliente (payload inválido,
   * autenticação, etc.) que não se resolvem com nova tentativa.
   *
   * @param url     URL alvo
   * @param init    Opções do fetch (method, headers, body)
   * @returns       Response da última tentativa bem-sucedida ou lança erro após esgotar retries
   */
  private async fetchWithRetry(url: string, init?: RequestInit): Promise<Response> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const res = await fetch(url, init);

        // Retenta apenas em 429 e 5xx — outros status são retornados diretamente
        // para o caller decidir o que fazer (evita esconder 4xx como falhas transitórias).
        if (attempt < this.maxRetries && (res.status === 429 || res.status >= 500)) {
          const retryAfterHeader = res.headers.get('retry-after');
          const waitMs = retryAfterHeader
            ? parseInt(retryAfterHeader, 10) * 1000
            : this.backoffMs(attempt);
          this.logger.warn(
            `Replicate HTTP ${res.status} (tentativa ${attempt + 1}/${this.maxRetries + 1}) — aguardando ${waitMs}ms antes de retentar.`,
          );
          await sleep(waitMs);
          continue;
        }

        return res;
      } catch (err) {
        lastError = err;
        if (attempt < this.maxRetries) {
          const waitMs = this.backoffMs(attempt);
          this.logger.warn(
            `Replicate fetch erro de rede (tentativa ${attempt + 1}/${this.maxRetries + 1}): ${(err as Error).message} — aguardando ${waitMs}ms.`,
          );
          await sleep(waitMs);
        }
      }
    }

    throw lastError ?? new Error(`Replicate fetch falhou após ${this.maxRetries + 1} tentativas: ${url}`);
  }

  /**
   * Calcula o intervalo de espera com backoff exponencial + jitter aleatório (±25%).
   * Fórmula: base * 2^attempt * (0.75 + random * 0.5)
   * Ex.: tentativa 0 → ~200ms, 1 → ~400ms, 2 → ~800ms
   */
  private backoffMs(attempt: number): number {
    const base = this.retryBaseMs * Math.pow(2, attempt);
    const jitter = base * (0.75 + Math.random() * 0.5);
    return Math.round(jitter);
  }
  /**
   * Variante ASSÍNCRONA de `run()`: cria o prediction com um `webhook` de
   * callback e retorna IMEDIATAMENTE (sem polling), para o fluxo de Geração
   * de Vídeo Assíncrona (202 Accepted + resultado via webhook). Usada pelo
   * `AiOrchestratorService` como fallback do circuit breaker do Fal.ai.
   */
  async createPredictionAsync(
    modelVersion: string,
    input: Record<string, unknown>,
    webhookUrl: string,
  ): Promise<{ id: string; status: string }> {
    if (!this.apiToken) throw new Error('REPLICATE_API_TOKEN não configurado.');

    const endpoint = modelVersion.includes(':')
      ? `${this.baseUrl}/predictions`
      : `${this.baseUrl}/models/${modelVersion}/predictions`;

    const body: Record<string, unknown> = {
      input,
      webhook: webhookUrl,
      webhook_events_filter: ['completed'],
    };
    if (modelVersion.includes(':')) body.version = modelVersion.split(':')[1];

    const res = await this.fetchWithRetry(endpoint, {
      method: 'POST',
      headers: { Authorization: `Token ${this.apiToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Replicate create prediction (async) falhou (${res.status}): ${err}`);
    }
    const prediction: { id: string; status: string } = (await res.json()) as any;
    return prediction;
  }
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}
