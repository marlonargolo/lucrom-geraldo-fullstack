// LUCROM Studio AI — modelo de dados do estúdio (Fase 0 + espinha do pipeline)
// Nesta versão os dados de produção são simulados para validar fluxo, design e
// padrão de acabamento antes de plugar os modelos de IA e a infra (fases seguintes).

export type EngineId =
  | "M1"
  | "M2"
  | "M3"
  | "M4"
  | "M5"
  | "M6"
  | "M7"
  | "M8"
  | "M9"
  | "M10"
  | "M11"
  | "M12"
  | "M13"

export type ModuleId =
  | "intake"
  | "roteirizacao"
  | "visual"
  | "audio"
  | "pos"
  | "qa"

export interface StudioModule {
  id: ModuleId
  index: number
  name: string
  role: string
}

export interface Engine {
  id: EngineId
  name: string
  role: string // o cargo de agência que este motor substitui
  module: ModuleId
  desc: string
}

export interface AuditGate {
  id: string
  name: string
  criteria: string[]
  threshold: number // fidelidade mínima exigida (%)
}

export interface LayerDef {
  key: string
  name: string
  engine: EngineId
  detail: string
}

// Os 6 módulos do pipeline (do documento mestre)
export const MODULES: StudioModule[] = [
  { id: "intake", index: 1, name: "Intake", role: "Atendimento & Planejamento" },
  { id: "roteirizacao", index: 2, name: "Roteirização", role: "Criação & Redação" },
  { id: "visual", index: 3, name: "Geração Visual", role: "Direção de Arte & Produção" },
  { id: "audio", index: 4, name: "Voz & Áudio", role: "Locução & Sound Design" },
  { id: "pos", index: 5, name: "Pós-produção", role: "Edição, Color & Motion" },
  { id: "qa", index: 6, name: "QA & Entrega", role: "Direção de Criação & Tráfego" },
]

// Os 13 motores de IA — cada um substitui uma função de uma agência real
export const ENGINES: Engine[] = [
  {
    id: "M1",
    name: "Estratégia",
    role: "Estrategista de Marca",
    module: "intake",
    desc: "Lê o briefing, define objetivo, público, plataforma e KPIs. Traduz negócio em direção criativa.",
  },
  {
    id: "M2",
    name: "Big Idea",
    role: "Diretor de Criação",
    module: "roteirizacao",
    desc: "Gera o conceito central da peça — o insight que faz a campanha memorável, não genérica.",
  },
  {
    id: "M3",
    name: "Copywriting",
    role: "Redator Publicitário",
    module: "roteirizacao",
    desc: "Escreve headline, corpo e CTA no tom de voz exato da marca. Versões A/B.",
  },
  {
    id: "M4",
    name: "Roteiro & Storyboard",
    role: "Roteirista",
    module: "roteirizacao",
    desc: "Estrutura narrativa cena a cena, timing, e o storyboard de referência.",
  },
  {
    id: "M5",
    name: "Direção de Arte",
    role: "Diretor de Arte",
    module: "roteirizacao",
    desc: "Define paleta, tipografia, moodboard e grid — a assinatura visual da marca.",
  },
  {
    id: "M6",
    name: "Geração Visual & Avatares",
    role: "Produtor / Cinegrafista",
    module: "visual",
    desc: "Gera planos, cenários e avatares consentidos com consistência de identidade.",
  },
  {
    id: "M7",
    name: "Voz & Áudio",
    role: "Locutor & Sound Designer",
    module: "audio",
    desc: "Locução consentida, trilha original e sound design sincronizados à cena.",
  },
  {
    id: "M8",
    name: "Pós-produção",
    role: "Editor & Colorista",
    module: "pos",
    desc: "Montagem, color grading, motion e legendas — o acabamento cinematográfico.",
  },
  {
    id: "M9",
    name: "Controle de Qualidade",
    role: "Finalizador Técnico",
    module: "qa",
    desc: "Mede fidelidade objetiva: cor, brilho, ruído e volume vs. a referência.",
  },
  {
    id: "M10",
    name: "Auditoria (3 Portões)",
    role: "Direção de Criação",
    module: "qa",
    desc: "Reprova e reescreve o output até bater compliance de marca, qualidade AV e tom.",
  },
  {
    id: "M11",
    name: "Adaptação de Formatos",
    role: "Produtor de Mídia",
    module: "qa",
    desc: "Gera automaticamente Reel 9:16, Feed 1:1, YouTube 16:9 e Stories.",
  },
  {
    id: "M12",
    name: "Publicação",
    role: "Gestor de Tráfego",
    module: "qa",
    desc: "Agenda e distribui nas plataformas conectadas com aprovação humana.",
  },
  {
    id: "M13",
    name: "Analytics",
    role: "Analista de Performance",
    module: "qa",
    desc: "Mede performance real e realimenta a estratégia (M1) do próximo ciclo.",
  },
]

// Os 3 Portões de Auditoria (M10)
export const AUDIT_GATES: AuditGate[] = [
  {
    id: "brand",
    name: "Compliance de Marca",
    threshold: 99,
    criteria: [
      "Paleta dentro da tolerância de cor",
      "Tipografia e grid corretos",
      "Uso de logo conforme manual",
      "Nenhum item da lista de proibições",
    ],
  },
  {
    id: "av",
    name: "Qualidade Audiovisual",
    threshold: 99,
    criteria: [
      "Cor / brilho vs. referência",
      "Ruído e artefatos sob o limite",
      "Volume e loudness (LUFS) corretos",
      "Sincronia de áudio e legendas",
    ],
  },
  {
    id: "tone",
    name: "Tom de Voz & Texto",
    threshold: 99,
    criteria: [
      "Tom de voz fiel à marca",
      "Gramática e ortografia",
      "Claims legais e disclaimers",
      "CTA claro e correto",
    ],
  },
]

// O stack de camadas de produção (camadas sobre camadas, como numa agência)
export const LAYERS: LayerDef[] = [
  { key: "strategy", name: "Estratégia", engine: "M1", detail: "Objetivo, público e KPI definidos" },
  { key: "bigidea", name: "Conceito", engine: "M2", detail: "Big idea aprovada" },
  { key: "copy", name: "Copy", engine: "M3", detail: "Headline, corpo e CTA" },
  { key: "script", name: "Roteiro", engine: "M4", detail: "5 cenas, 30s" },
  { key: "storyboard", name: "Storyboard", engine: "M4", detail: "Frames de referência" },
  { key: "art", name: "Direção de Arte", engine: "M5", detail: "Paleta + tipografia + grid" },
  { key: "footage", name: "Geração de Planos", engine: "M6", detail: "Takes e avatares" },
  { key: "vo", name: "Locução", engine: "M7", detail: "Voz consentida" },
  { key: "music", name: "Trilha & SFX", engine: "M7", detail: "Trilha original" },
  { key: "edit", name: "Edição", engine: "M8", detail: "Corte e ritmo" },
  { key: "grade", name: "Color Grade", engine: "M8", detail: "Look cinematográfico" },
  { key: "mix", name: "Mix Final", engine: "M8", detail: "Master de áudio" },
  { key: "audit", name: "Auditoria", engine: "M10", detail: "3 portões aprovados" },
]

// Brand Kit — fonte de verdade contra a qual o compliance é medido
export interface BrandKit {
  id: string
  name: string
  voice: string
  palette: { name: string; hex: string }[]
  typography: string
  dos: string[]
  donts: string[]
}

export const BRAND_KITS: BrandKit[] = [
  {
    id: "aurora",
    name: "Aurora Bank",
    voice: "Direto, humano, confiante. Frases curtas. Zero jargão.",
    palette: [
      { name: "Ink", hex: "#0B0C10" },
      { name: "Bone", hex: "#F5F3EC" },
      { name: "Signal", hex: "#E8B341" },
    ],
    typography: "Space Grotesk / Inter",
    dos: ["Falar com o cliente, não sobre ele", "Mostrar pessoas reais", "Ritmo rápido"],
    donts: ["Clichê de fintech", "Stock genérico", "Promessas irreais"],
  },
  {
    id: "verde",
    name: "Verde Foods",
    voice: "Caloroso, apetitoso, próximo. Sensorial.",
    palette: [
      { name: "Basil", hex: "#1F3D2B" },
      { name: "Cream", hex: "#FBF7EE" },
      { name: "Chili", hex: "#D8552B" },
    ],
    typography: "Space Grotesk / Inter",
    dos: ["Macro de textura", "Luz natural", "Movimento suave"],
    donts: ["Cor artificial", "Excesso de texto", "Trilha agressiva"],
  },
]

// Formatos de saída
export const FORMATS = [
  { id: "reel", name: "Reel", ratio: "9:16", platform: "Instagram / TikTok" },
  { id: "feed", name: "Feed", ratio: "1:1", platform: "Instagram" },
  { id: "yt", name: "YouTube", ratio: "16:9", platform: "YouTube" },
  { id: "story", name: "Stories", ratio: "9:16", platform: "Instagram / WhatsApp" },
] as const

export const TONES = [
  "Nubank — direto e humano",
  "Apple — minimal e aspiracional",
  "Editorial — sofisticado",
  "Energético — jovem e rápido",
] as const

// Briefings de exemplo para testar rápido
export const SAMPLE_BRIEFS = [
  "Crie um Reel de 30s anunciando nossa nova conta digital sem tarifas, tom Nubank, com pessoas reais e um CTA para baixar o app.",
  "Vídeo de 20s para lançamento do burger da casa, apetitoso, luz natural, foco na textura, trilha suave.",
  "Peça 16:9 institucional de 45s sobre sustentabilidade da marca, tom Apple, aspiracional e minimalista.",
]
