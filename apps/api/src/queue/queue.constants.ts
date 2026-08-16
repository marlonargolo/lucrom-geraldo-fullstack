/**
 * Fila Principal (Redis/BullMQ):
 * `jobs-render-high-priority` para Enterprise e `jobs-render-standard` para
 * Creator. O BullMQ usa ':' como separador interno de chaves no Redis e
 * rejeita nomes de fila contendo ':' — por isso os nomes usam '-' em vez de
 * ':'.
 */
export const QUEUE_RENDER_HIGH_PRIORITY = 'jobs-render-high-priority'; // lógico: jobs:render:high_priority
export const QUEUE_RENDER_STANDARD = 'jobs-render-standard'; // lógico: jobs:render:standard

/**
 * Fila dedicada ao pós-processamento de vídeos gerados por IA (Fal.ai/Replicate,
 * via AiOrchestratorService + webhook). Separada das filas do M8 acima porque
 * atende a um pipeline diferente: redimensionamento de aspect ratio +
 * enquadramento + upload final no S3, consumido por `video-render.worker.ts`.
 */
export const QUEUE_VIDEO_RENDER = 'jobs-video-render';

/** Payload do job enfileirado para `video-render.worker.ts`. */
export interface VideoRenderJobData {
  aiGenerationJobId: string; // id da linha em ai_generation_jobs (Postgres)
  tenantId: string;
  rawVideoUrl: string; // URL do vídeo bruto retornado pelo provedor de IA
  aspectRatio: '9:16' | '16:9' | '1:1';
}

export function queueForPlanTier(planTier: string): string {
  return planTier === 'ENTERPRISE' ? QUEUE_RENDER_HIGH_PRIORITY : QUEUE_RENDER_STANDARD;
}

/**
 * Fila dedicada ao pós-processamento de vídeos de Avatar (Kling lip-sync,
 * via AvatarOrchestratorService + webhook). Separada de QUEUE_VIDEO_RENDER
 * de propósito: são pipelines diferentes (o de avatar nunca passa por
 * texto-para-vídeo, só por lip-sync sobre um vídeo-fonte real), mesmo
 * reaproveitando o MESMO FfmpegService.cropToAspectRatio no worker.
 */
export const QUEUE_AVATAR_RENDER = 'jobs-avatar-render';

/** Payload do job enfileirado para `avatar-render.worker.ts`. */
export interface AvatarRenderJobData {
  avatarGenerationJobId: string; // id da linha em avatar_generation_jobs (Postgres)
  tenantId: string;
  rawVideoUrl: string; // URL do vídeo com lip-sync, retornado pela Kling
  aspectRatio: '9:16' | '16:9' | '1:1';
}

/** Payload do job enfileirado para o motor M8. */
export interface M8RenderJobData {
  renderJobId: string; // id da linha em render_jobs (Postgres)
  tenantId: string;
  scriptId: string;
  rawAssetId: string;
  pipelineOptions: {
    // ─── Opções originais (preservadas integralmente) ───────────────────────
    enable_relighting?: boolean;
    enable_lip_sync?: boolean;
    subtitles_style?: string;
    background_denoise?: boolean;

    // ─── Etapa 1: Audio Clean & Sync (WhisperX + DeepFilterNet) ─────────────
    /** Ativa isolamento vocal via DeepFilterNet + transcrição via WhisperX. */
    enable_audio_clean?: boolean;
    /** Idioma para o WhisperX (padrão: 'pt'). */
    language?: string;

    // ─── Etapas 2+3: Video Matting + Niche Preset (Replicate) ───────────────
    /**
     * Ativa recorte de fundo via Robust Video Matting (RVM).
     * Exige `niche` para compor sobre o fundo gerado.
     */
    enable_matting?: boolean;
    /**
     * Nicho comercial — controla o prompt do fundo gerado (Flux)
     * e o estilo visual das legendas.
     * Valores: 'marcenaria' | 'farmacia' | 'mercado' | 'escritorio'
     */
    niche?: string;

    // ─── Dimensões de saída ──────────────────────────────────────────────────
    output_width?: number;
    output_height?: number;
  };
  brandKit?: {
    palette: string[]; // cores hex oficiais da marca
    forbiddenWords?: string[];
  } | null;
  /** s3_key do vídeo/imagem de referência ("molde") usado pelo Gate 2 (fidelidade). */
  referenceVideoKey?: string | null;
  /** Texto do roteiro/copy, usado pelos Gates 1 e 3. */
  scriptText?: string | null;
}
