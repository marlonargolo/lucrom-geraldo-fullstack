import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Cliente HTTP para a API oficial da MiniMax (Hailuo) — api.minimax.io.
 * Usado como fallback pelo circuit breaker do AiOrchestratorService quando
 * o Kling falha, e diretamente pelo Avatar Engine para clonagem de voz e TTS.
 *
 * Autenticação: Bearer token estático (API Key gerada no painel MiniMax —
 * bem mais simples que o JWT por-requisição do Kling).
 *
 * Assíncrono via callback_url, igual ao Kling.
 * IMPORTANTE (particularidade da MiniMax, documentada pela própria API):
 * ao registrar um callback_url, a MiniMax primeiro envia uma requisição de
 * VALIDAÇÃO com um campo `challenge` — nosso endpoint precisa ecoar esse
 * valor de volta em até 3s, ou o callback não é registrado. Isso é tratado
 * no WebhooksController (ver `handleMinimaxChallenge`).
 */
@Injectable()
export class MinimaxClientService {
  private readonly logger = new Logger(MinimaxClientService.name);

  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('minimax.apiKey') ?? '';
    this.baseUrl = this.config.get<string>('minimax.baseUrl') ?? 'https://api.minimax.io';

    if (!this.apiKey) {
      this.logger.warn('MINIMAX_API_KEY não configurado — fallback via MiniMax estará desabilitado.');
    }
  }

  get isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  /**
   * Submete uma geração de texto-para-vídeo. Retorna o `task_id` da MiniMax
   * imediatamente (chamada não bloqueante — sem polling aqui).
   */
  async submitTextToVideo(params: {
    model: string;
    prompt: string;
    callbackUrl: string;
  }): Promise<{ taskId: string }> {
    if (!this.isConfigured) {
      throw new Error('MINIMAX_API_KEY não configurado.');
    }

    const res = await fetch(`${this.baseUrl}/v1/video_generation`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: params.model,
        prompt: params.prompt,
        callback_url: params.callbackUrl,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`MiniMax HTTP ${res.status}: ${errText}`);
    }

    const data: { task_id?: string; base_resp?: { status_code?: number; status_msg?: string } } =
      (await res.json()) as any;

    if (data.base_resp && data.base_resp.status_code !== 0) {
      throw new Error(`MiniMax retornou erro: ${data.base_resp.status_msg ?? data.base_resp.status_code}`);
    }
    if (!data.task_id) throw new Error('MiniMax não retornou task_id válido.');

    return { taskId: data.task_id };
  }

  /**
   * A MiniMax devolve o resultado do webhook como `file_id`, não a URL
   * final — é preciso um segundo request pra resolver o `file_id` na URL
   * de download real. Usado pelo WebhooksController quando o callback
   * reporta status "success".
   */
  async retrieveFileUrl(fileId: string): Promise<string> {
    if (!this.isConfigured) throw new Error('MINIMAX_API_KEY não configurado.');

    const res = await fetch(`${this.baseUrl}/v1/files/retrieve?file_id=${encodeURIComponent(fileId)}`, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`MiniMax HTTP ${res.status} (files/retrieve): ${errText}`);
    }
    const data: { file?: { download_url?: string } } = (await res.json()) as any;
    const url = data.file?.download_url;
    if (!url) throw new Error('MiniMax não retornou download_url para o file_id informado.');
    return url;
  }

  /**
   * VOZ CLONADA / TTS (adicionado para o AvatarOrchestratorModule).
   *
   * Estas três chamadas são SEMPRE síncronas (diferente de submitTextToVideo
   * acima, que é assíncrono) — a MiniMax devolve o resultado pronto na
   * própria resposta HTTP, sem callback_url/webhook envolvido aqui. Fluxo:
   *
   *   1) uploadFile()      — sobe a amostra de áudio, recebe file_id.
   *   2) cloneVoice()      — usa o file_id, recebe voice_id.
   *   3) synthesizeSpeech()— usa o voice_id + texto novo, recebe o áudio final.
   *
   * IMPORTANTE — regra operacional real da MiniMax (não é limitação nossa):
   * uma voz clonada só fica PERMANENTE depois de ser usada em pelo menos
   * uma síntese (synthesizeSpeech) dentro de 168h (7 dias) da clonagem. Se
   * isso não acontecer, o voice_id expira. Por isso o
   * AvatarOrchestratorService sempre encadeia cloneVoice → synthesizeSpeech
   * na mesma operação, nunca deixa a voz "só clonada e parada".
   */
  async uploadFile(params: { buffer: Buffer; fileName: string; purpose: 'voice_clone' }): Promise<{ fileId: string }> {
    if (!this.isConfigured) throw new Error('MINIMAX_API_KEY não configurado.');

    const form = new FormData();
    form.append('purpose', params.purpose);
    form.append('file', new Blob([params.buffer]), params.fileName);

    const res = await fetch(`${this.baseUrl}/v1/files/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}` },
      body: form,
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`MiniMax HTTP ${res.status} (files/upload): ${errText}`);
    }

    const data: { file?: { file_id?: string } } = (await res.json()) as any;
    const fileId = data.file?.file_id;
    if (!fileId) throw new Error('MiniMax não retornou file_id válido (files/upload).');
    return { fileId };
  }

  /**
   * Clona a voz a partir do `fileId` já enviado. `voiceId` é escolhido por
   * NÓS (identificador custom, ex: `voice-clone-{tenantId}-{timestamp}`),
   * não é gerado pela MiniMax.
   */
  async cloneVoice(params: { fileId: string; voiceId: string; model?: string }): Promise<{ voiceId: string }> {
    if (!this.isConfigured) throw new Error('MINIMAX_API_KEY não configurado.');

    const res = await fetch(`${this.baseUrl}/v1/voice_clone`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        file_id: params.fileId,
        voice_id: params.voiceId,
        model: params.model ?? 'speech-2.6-hd',
        need_noise_reduction: true,
        need_volumn_normalization: true,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`MiniMax HTTP ${res.status} (voice_clone): ${errText}`);
    }

    const data: { base_resp?: { status_code?: number; status_msg?: string } } = (await res.json()) as any;
    if (data.base_resp && data.base_resp.status_code !== 0) {
      throw new Error(`MiniMax retornou erro (voice_clone): ${data.base_resp.status_msg ?? data.base_resp.status_code}`);
    }

    return { voiceId: params.voiceId };
  }

  /**
   * Sintetiza texto em áudio usando uma voz clonada. Devolve o áudio já
   * decodificado (a MiniMax retorna hex por padrão nesta rota; convertemos
   * pra Buffer aqui, então quem chama nunca precisa saber desse detalhe).
   */
  async synthesizeSpeech(params: { voiceId: string; text: string; model?: string }): Promise<Buffer> {
    if (!this.isConfigured) throw new Error('MINIMAX_API_KEY não configurado.');

    const res = await fetch(`${this.baseUrl}/v1/t2a_v2`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: params.model ?? 'speech-2.6-hd',
        text: params.text,
        voice_setting: { voice_id: params.voiceId, speed: 1.0, vol: 1.0, pitch: 0 },
        audio_setting: { sample_rate: 32000, bitrate: 128000, format: 'mp3' },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`MiniMax HTTP ${res.status} (t2a_v2): ${errText}`);
    }

    const data: { data?: { audio?: string }; base_resp?: { status_code?: number; status_msg?: string } } =
      (await res.json()) as any;

    if (data.base_resp && data.base_resp.status_code !== 0) {
      throw new Error(`MiniMax retornou erro (t2a_v2): ${data.base_resp.status_msg ?? data.base_resp.status_code}`);
    }
    const audioHex = data.data?.audio;
    if (!audioHex) throw new Error('MiniMax não retornou áudio (t2a_v2).');

    return Buffer.from(audioHex, 'hex');
  }
}
