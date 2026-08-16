import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';

/**
 * Cliente HTTP para a API oficial do Kling AI (api-singapore.klingai.com /
 * api.klingai.com), da Kuaishou, chamada diretamente sem intermediário.
 *
 * Autenticação: Kling usa JWT assinado com HS256, não uma chave estática —
 * o token é gerado a cada requisição (payload curto, expiração de ~30min)
 * a partir de um par Access Key ID / Access Key Secret obtido no painel de
 * desenvolvedor da Kling (kling.ai/dev). Ver `buildJwt()`.
 *
 * Padrão assíncrono: submete e retorna imediatamente; o resultado chega
 * depois via `callback_url` (suportado nativamente pela API do Kling).
 */
@Injectable()
export class KlingClientService {
  private readonly logger = new Logger(KlingClientService.name);

  private readonly accessKeyId: string;
  private readonly accessKeySecret: string;
  private readonly baseUrl: string;

  constructor(private readonly config: ConfigService) {
    this.accessKeyId = this.config.get<string>('aiOrchestrator.klingAccessKeyId') ?? '';
    this.accessKeySecret = this.config.get<string>('aiOrchestrator.klingAccessKeySecret') ?? '';
    this.baseUrl = this.config.get<string>('aiOrchestrator.klingBaseUrl') ?? 'https://api-singapore.klingai.com';

    if (!this.accessKeyId || !this.accessKeySecret) {
      this.logger.warn(
        'KLING_ACCESS_KEY_ID / KLING_ACCESS_KEY_SECRET não configurados — geração de vídeo via Kling estará desabilitada.',
      );
    }
  }

  get isConfigured(): boolean {
    return Boolean(this.accessKeyId && this.accessKeySecret);
  }

  /**
   * Gera o JWT curto exigido pela API do Kling em cada requisição.
   * `iss` = Access Key ID, assinado com o Access Key Secret (HS256).
   * `nbf` com folga de 5s pra tolerar clock skew entre nosso servidor e o
   * da Kling; `exp` de 30 minutos (bem acima do tempo de uma chamada HTTP).
   */
  private buildJwt(): string {
    const now = Math.floor(Date.now() / 1000);
    return jwt.sign(
      {
        iss: this.accessKeyId,
        exp: now + 1800,
        nbf: now - 5,
      },
      this.accessKeySecret,
      { algorithm: 'HS256', header: { alg: 'HS256', typ: 'JWT' } },
    );
  }

  /**
   * Submete uma geração de texto-para-vídeo. Retorna o `task_id` do Kling
   * imediatamente (chamada não bloqueante — sem polling aqui).
   */
  async submitTextToVideo(params: {
    model: string;
    prompt: string;
    aspectRatio: '9:16' | '16:9' | '1:1';
    callbackUrl: string;
  }): Promise<{ taskId: string }> {
    if (!this.isConfigured) {
      throw new Error('KLING_ACCESS_KEY_ID/KLING_ACCESS_KEY_SECRET não configurados.');
    }

    const res = await fetch(`${this.baseUrl}/v1/videos/text2video`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.buildJwt()}`,
        'Content-Type': 'application/json',
      },
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

  /**
   * AVATAR / LIP-SYNC (adicionado para o AvatarOrchestratorModule).
   *
   * A Kling expõe lip-sync como uma operação sobre um VÍDEO já existente
   * (o vídeo do avatar/pessoa, ex: enviado pelo tenant) + um ÁUDIO (a
   * narração já sintetizada pela MiniMax, com a voz clonada) — ela não cria
   * um "avatar" reutilizável como HeyGen faz; cada chamada é uma
   * transformação vídeo+áudio → vídeo com boca sincronizada.
   *
   * Endpoint oficial: POST /v1/videos/advanced-lip-sync
   * (api-singapore.klingai.com — mesmo host já usado acima).
   *
   * Requer um `face_id`, obtido por uma etapa prévia de reconhecimento
   * facial sobre o vídeo de origem (`identifyFace`). Isso é INTENCIONAL:
   * a Kling só sincroniza o rosto que ela mesma identificou — não aceita
   * coordenadas arbitrárias — o que reduz risco de uso indevido (não dá
   * pra "colar" uma voz em qualquer rosto sem a Kling primeiro confirmar
   * que há um rosto detectável e claro naquele ponto do vídeo).
   *
   * IMPORTANTE (mesmo padrão de honestidade do restante deste arquivo):
   * o payload de `identifyFace` abaixo segue a documentação oficial
   * disponível publicamente em kling.ai/document-api; como a Kling não
   * publica um sandbox público, valide o formato exato de resposta contra
   * a conta real de desenvolvedor antes de ligar isso em produção — mesma
   * ressalva que já vale pra `submitTextToVideo` acima.
   */
  async identifyFace(params: { videoUrl: string }): Promise<{ sessionId: string; faceId: string }> {
    if (!this.isConfigured) {
      throw new Error('KLING_ACCESS_KEY_ID/KLING_ACCESS_KEY_SECRET não configurados.');
    }

    const res = await fetch(`${this.baseUrl}/v1/videos/face-detect`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.buildJwt()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ video_url: params.videoUrl }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Kling HTTP ${res.status} (face-detect): ${errText}`);
    }

    const data: { data?: { session_id?: string; faces?: Array<{ face_id?: string }> } } = (await res.json()) as any;
    const sessionId = data.data?.session_id;
    const faceId = data.data?.faces?.[0]?.face_id;
    if (!sessionId || !faceId) {
      throw new Error('Kling não identificou nenhum rosto claro no vídeo enviado (face-detect vazio).');
    }

    return { sessionId, faceId };
  }

  /**
   * Aplica lip-sync: o rosto identificado (`faceId`, dentro da `sessionId`
   * retornada por `identifyFace`) passa a "falar" o áudio fornecido
   * (`soundFileUrl` — a narração da MiniMax). Assíncrono, resultado chega
   * no `callbackUrl` (mesmo mecanismo de `submitTextToVideo`).
   */
  async submitLipSync(params: {
    sessionId: string;
    faceId: string;
    soundFileUrl: string;
    callbackUrl: string;
    externalTaskId: string;
  }): Promise<{ taskId: string }> {
    if (!this.isConfigured) {
      throw new Error('KLING_ACCESS_KEY_ID/KLING_ACCESS_KEY_SECRET não configurados.');
    }

    const res = await fetch(`${this.baseUrl}/v1/videos/advanced-lip-sync`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.buildJwt()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        session_id: params.sessionId,
        face_choose: [
          {
            face_id: params.faceId,
            sound_file: params.soundFileUrl,
            sound_insert_time: 0,
            sound_start_time: 0,
            // sound_end_time é preenchido pela Kling com a duração real do áudio quando omitido.
            sound_volume: 2,
            original_audio_volume: 0, // zera o áudio original do vídeo-fonte — só a narração nova deve tocar.
          },
        ],
        external_task_id: params.externalTaskId,
        callback_url: params.callbackUrl,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Kling HTTP ${res.status} (advanced-lip-sync): ${errText}`);
    }

    const data: { data?: { task_id?: string } } = (await res.json()) as any;
    const taskId = data.data?.task_id;
    if (!taskId) throw new Error('Kling não retornou task_id válido (advanced-lip-sync).');

    return { taskId };
  }
}
