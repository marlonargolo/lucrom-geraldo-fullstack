import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Cliente HTTP para a API do Kling AI (api-singapore.klingai.com).
 *
 * Autenticação: API Key simples no header Authorization: Bearer <key>.
 * O modelo antigo (Access Key ID + Secret → JWT) foi descontinuado.
 */
@Injectable()
export class KlingClientService {
  private readonly logger = new Logger(KlingClientService.name);

  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey =
      this.config.get<string>('aiOrchestrator.klingApiKey') ?? '';
    this.baseUrl =
      this.config.get<string>('aiOrchestrator.klingBaseUrl') ??
      'https://api-singapore.klingai.com';

    if (!this.apiKey) {
      this.logger.warn(
        'KLING_API_KEY não configurado — geração de vídeo via Kling estará desabilitada.',
      );
    }
  }

  get isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  private authHeader(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  async submitTextToVideo(params: {
    model: string;
    prompt: string;
    aspectRatio: '9:16' | '16:9' | '1:1';
    callbackUrl: string;
  }): Promise<{ taskId: string }> {
    if (!this.isConfigured) {
      throw new Error('KLING_API_KEY não configurado.');
    }

    const res = await fetch(`${this.baseUrl}/v1/videos/text2video`, {
      method: 'POST',
      headers: this.authHeader(),
      body: JSON.stringify({
        model_name: params.model,
        prompt: params.prompt,
        aspect_ratio: params.aspectRatio,
        callback_url: params.callbackUrl,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Kling HTTP ${res.status}: ${errText}`);
    }

    const data: { data?: { task_id?: string } } = (await res.json()) as any;
    const taskId = data.data?.task_id;
    if (!taskId) throw new Error('Kling não retornou task_id válido.');

    return { taskId };
  }

  async identifyFace(params: {
    videoUrl: string;
  }): Promise<{ sessionId: string; faceId: string }> {
    if (!this.isConfigured) {
      throw new Error('KLING_API_KEY não configurado.');
    }

    const res = await fetch(`${this.baseUrl}/v1/videos/face-detect`, {
      method: 'POST',
      headers: this.authHeader(),
      body: JSON.stringify({ video_url: params.videoUrl }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Kling HTTP ${res.status} (face-detect): ${errText}`);
    }

    const data: {
      data?: { session_id?: string; faces?: Array<{ face_id?: string }> };
    } = (await res.json()) as any;
    const sessionId = data.data?.session_id;
    const faceId = data.data?.faces?.[0]?.face_id;
    if (!sessionId || !faceId) {
      throw new Error(
        'Kling não identificou nenhum rosto claro no vídeo enviado.',
      );
    }

    return { sessionId, faceId };
  }

  async submitLipSync(params: {
    sessionId: string;
    faceId: string;
    soundFileUrl: string;
    callbackUrl: string;
    externalTaskId: string;
  }): Promise<{ taskId: string }> {
    if (!this.isConfigured) {
      throw new Error('KLING_API_KEY não configurado.');
    }

    const res = await fetch(`${this.baseUrl}/v1/videos/advanced-lip-sync`, {
      method: 'POST',
      headers: this.authHeader(),
      body: JSON.stringify({
        session_id: params.sessionId,
        face_choose: [
          {
            face_id: params.faceId,
            sound_file: params.soundFileUrl,
            sound_insert_time: 0,
            sound_start_time: 0,
            sound_volume: 2,
            original_audio_volume: 0,
          },
        ],
        external_task_id: params.externalTaskId,
        callback_url: params.callbackUrl,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(
        `Kling HTTP ${res.status} (advanced-lip-sync): ${errText}`,
      );
    }

    const data: { data?: { task_id?: string } } = (await res.json()) as any;
    const taskId = data.data?.task_id;
    if (!taskId)
      throw new Error('Kling não retornou task_id válido (advanced-lip-sync).');

    return { taskId };
  }
}