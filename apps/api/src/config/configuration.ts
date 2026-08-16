export default () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  apiToken: process.env.API_TOKEN ?? '',

  db: {
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    user: process.env.DB_USER ?? 'lucrom',
    password: process.env.DB_PASSWORD ?? 'lucrom',
    name: process.env.DB_NAME ?? 'lucrom_studio_ai',
  },

  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
  },

  s3: {
    endPoint: process.env.S3_ENDPOINT ?? 'localhost',
    port: parseInt(process.env.S3_PORT ?? '9000', 10),
    useSSL: process.env.S3_USE_SSL === 'true',
    accessKey: process.env.S3_ACCESS_KEY ?? '',
    secretKey: process.env.S3_SECRET_KEY ?? '',
    bucket: process.env.S3_BUCKET ?? 'lucrom-studio-media',
    publicUrl: process.env.S3_PUBLIC_URL ?? 'http://localhost:9000',
  },

  worker: {
    concurrency: parseInt(process.env.WORKER_CONCURRENCY ?? '2', 10),
  },

  // ===== Replicate AI (Etapas 1-3 do pipeline M8) =====
  replicate: {
    /**
     * Token de API do Replicate — obrigatório para as etapas generativas
     * (Video Matting, WhisperX, DeepFilterNet, Flux/background).
     * Obtenha em https://replicate.com/account/api-tokens
     */
    apiToken: process.env.REPLICATE_API_TOKEN ?? '',
  },

  // ===== IDs de modelos generativos (sobrescrevíveis por env) =====
  generative: {
    models: {
      /**
       * Robust Video Matting — Etapa 2: recorte de fundo sem chroma key físico.
       * Modelo padrão: arielreplicate/robust_video_matting
       */
      robustVideoMatting:
        process.env.MODEL_ROBUST_VIDEO_MATTING ??
        'arielreplicate/robust_video_matting',

      /**
       * WhisperX — Etapa 1: transcrição com word-level timestamps.
       * Modelo padrão: victor-upmeet/whisperx
       */
      whisperX:
        process.env.MODEL_WHISPERX ??
        'victor-upmeet/whisperx:84d2ad2d6194fe98efb918a5bc05c61ebef18cce5d77c7a7ce5b1b6b7cfd7c7f',

      /**
       * DeepFilterNet — Etapa 1: isolamento vocal / remoção de ruído de fundo.
       * Modelo padrão: adirik/deepfilternet
       */
      deepFilterNet:
        process.env.MODEL_DEEPFILTERNET ?? 'adirik/deepfilternet',

      /**
       * Flux — Etapa 3: geração de fundo por nicho (Generative Backgrounds).
       * Modelo padrão: black-forest-labs/flux-schnell (rápido, 4 steps)
       */
      flux:
        process.env.MODEL_FLUX ?? 'black-forest-labs/flux-schnell',
    },
  },

  // ===== LLM (ScriptGeneratorService + VoiceCommandService + DigitalTwinModule) =====
  // Provedor padrão: DeepSeek (API paga chinesa, compatível com o formato
  // OpenAI /chat/completions) — decisão registrada na conversa que precedeu
  // esta config: manter a stack de IA generativa 100% em fornecedores
  // chineses pagos (mesmo padrão já usado em voz/MiniMax e avatar/Kling).
  // Os nomes das env vars (LLM_*) foram mantidos EXATAMENTE como estavam
  // (não são LLM_*_ANTHROPIC nem DEEPSEEK_*) de propósito: troca de
  // provedor não deve exigir migração de .env em quem já rodava isso antes.
  llm: {
    /** Chave de API do provedor LLM (DeepSeek Platform API por padrão). */
    apiKey: process.env.LLM_API_KEY ?? process.env.DEEPSEEK_API_KEY ?? '',
    /** Modelo usado nas chamadas de geração de roteiro e interpretação de comandos de voz. */
    model: process.env.LLM_MODEL ?? 'deepseek-chat',
    /** Endpoint da API (permite apontar para um proxy/gateway compatível, ex. Azure/self-host). */
    baseUrl: process.env.LLM_BASE_URL ?? 'https://api.deepseek.com/chat/completions',
    /**
     * Cache automático de contexto da DeepSeek (Context Caching on Disk):
     * ativo por padrão em todas as chamadas, sem precisar de nenhum header
     * especial (diferente do `anthropic-beta: prompt-caching` da Anthropic).
     * Guardado aqui só para permitir desligar via env se algum dia
     * precisarmos comparar custo com/sem cache.
     */
    contextCachingEnabled: (process.env.LLM_CONTEXT_CACHING ?? 'true') !== 'false',
  },

  // ===== Puppeteer (GraphicComposerService) =====
  puppeteer: {
    /** Caminho de um Chromium já instalado no ambiente, se não quiser usar o bundled do Puppeteer. */
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH ?? '',
  },

  // ===== JWT (AuthAuditMiddleware — identificação do ator na trilha de auditoria) =====
  // MVP: ApiTokenGuard (token estático) continua sendo o mecanismo de AUTORIZAÇÃO.
  // Este segredo só é usado para verificar/decodificar um JWT opcional enviado em
  // X-Actor-Token, quando o cliente já tiver um token de sessão de usuário — serve
  // apenas para enriquecer o `actor` gravado em audit_logs, nunca para autorizar.
  jwt: {
    secret: process.env.JWT_SECRET ?? '',
    /**
     * Tempo de expiração do JWT de sessão emitido por AuthService
     * (register/login). Passa a ser usado também como o mesmo JWT opcional
     * lido em X-Actor-Token pelo AuthAuditMiddleware — mesmo segredo,
     * mesmo payload { sub, tenantId, email, role }.
     */
    expiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  },

  // ===== Orquestração de IA de vídeo — somente provedores chineses =====
  // Kling (Kuaishou) é o provedor primário; MiniMax (Hailuo) é o fallback.
  // Ambos são chamados diretamente pelas APIs oficiais, sem intermediário.
  aiOrchestrator: {
    // Kling AI (Kuaishou) — API oficial direta. Autenticação via JWT
    // assinado com Access Key ID + Access Key Secret (não é um Bearer
    // estático — o token é gerado por requisição, ver kling-client.service.ts).
    klingAccessKeyId: process.env.KLING_ACCESS_KEY_ID ?? '',
    klingAccessKeySecret: process.env.KLING_ACCESS_KEY_SECRET ?? '',
    klingBaseUrl: process.env.KLING_BASE_URL ?? 'https://api-singapore.klingai.com',
    klingModel: process.env.KLING_MODEL ?? 'kling-v1',
    /** Falhas consecutivas do Kling antes de o circuit breaker acionar o fallback pro MiniMax. */
    circuitBreakerThreshold: parseInt(process.env.AI_CIRCUIT_BREAKER_THRESHOLD ?? '3', 10),
    /** Após esse tempo sem novas falhas, o circuito volta a tentar o Kling como primário. */
    circuitBreakerCooldownMs: parseInt(process.env.AI_CIRCUIT_BREAKER_COOLDOWN_MS ?? '60000', 10),
    /** URL pública desta API, usada para montar a URL de callback dos webhooks dos provedores. */
    publicWebhookBaseUrl: process.env.PUBLIC_WEBHOOK_BASE_URL ?? 'http://localhost:3000',
  },

  // MiniMax (Hailuo) — API oficial direta, usada como FALLBACK do circuit
  // breaker acima (era o mesmo modelo antes, mas via Replicate/EUA).
  minimax: {
    apiKey: process.env.MINIMAX_API_KEY ?? '',
    baseUrl: process.env.MINIMAX_BASE_URL ?? 'https://api.minimax.io',
    model: process.env.MINIMAX_MODEL ?? 'MiniMax-Hailuo-2.3',
  },
});
