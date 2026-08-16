// LUCROM Studio AI — Fase 1: Arquitetura Técnica, Dados e Infra
// Blueprint tipado. Quando o banco real for plugado (Neon/Postgres), estas
// definições viram o schema. Multi-tenancy é regra: TODA linha é isolada por tenant.

export interface Column {
  name: string
  type: string
  note?: string
  pk?: boolean
  fk?: string
  tenant?: boolean // coluna de isolamento multi-tenant
}

export interface TableDef {
  name: string
  purpose: string
  columns: Column[]
  fromDoc?: boolean // tabela exigida explicitamente no documento mestre
}

// Modelo de dados mínimo do documento + tabelas de suporte para o pipeline real
export const TABLES: TableDef[] = [
  {
    name: "tenants",
    fromDoc: true,
    purpose: "Raiz do multi-tenancy. Cada cliente (Creator ou Enterprise) é um tenant isolado.",
    columns: [
      { name: "id", type: "uuid", pk: true },
      { name: "name", type: "text" },
      { name: "plan", type: "enum(creator,enterprise)" },
      { name: "region", type: "text", note: "residência de dados / LGPD" },
      { name: "seats", type: "int", note: "assentos RBAC" },
      { name: "created_at", type: "timestamptz" },
    ],
  },
  {
    name: "users",
    purpose: "Usuários com RBAC. Papel define o que pode aprovar nos gates.",
    columns: [
      { name: "id", type: "uuid", pk: true },
      { name: "tenant_id", type: "uuid", fk: "tenants.id", tenant: true },
      { name: "email", type: "citext" },
      { name: "role", type: "enum(owner,admin,creator,reviewer,viewer)" },
      { name: "created_at", type: "timestamptz" },
    ],
  },
  {
    name: "brand_kits",
    purpose: "Fonte de verdade da marca. O compliance mede contra isto, não contra 'bom gosto'.",
    columns: [
      { name: "id", type: "uuid", pk: true },
      { name: "tenant_id", type: "uuid", fk: "tenants.id", tenant: true },
      { name: "name", type: "text" },
      { name: "palette", type: "jsonb", note: "cores + tolerância ΔE" },
      { name: "typography", type: "jsonb" },
      { name: "voice", type: "text", note: "tom de voz" },
      { name: "rules", type: "jsonb", note: "do's / don'ts / claims legais" },
    ],
  },
  {
    name: "consents",
    purpose: "Consentimento LGPD de voz e rosto. Sem registro válido, geração é bloqueada.",
    columns: [
      { name: "id", type: "uuid", pk: true },
      { name: "tenant_id", type: "uuid", fk: "tenants.id", tenant: true },
      { name: "subject", type: "text", note: "pessoa / avatar / locutor" },
      { name: "kind", type: "enum(face,voice)" },
      { name: "scope", type: "jsonb", note: "usos autorizados" },
      { name: "expires_at", type: "timestamptz" },
      { name: "proof_url", type: "text", note: "termo assinado" },
    ],
  },
  {
    name: "projects",
    purpose: "Um briefing e sua produção. Agrupa as camadas e os assets gerados.",
    columns: [
      { name: "id", type: "uuid", pk: true },
      { name: "tenant_id", type: "uuid", fk: "tenants.id", tenant: true },
      { name: "brand_kit_id", type: "uuid", fk: "brand_kits.id" },
      { name: "brief", type: "text" },
      { name: "format", type: "text", note: "reel/feed/yt/story" },
      { name: "status", type: "enum(draft,running,review,done,failed)" },
      { name: "created_by", type: "uuid", fk: "users.id" },
    ],
  },
  {
    name: "layers",
    purpose: "Camadas versionadas (roteiro, arte, edição...). O 'camadas sobre camadas' da agência.",
    columns: [
      { name: "id", type: "uuid", pk: true },
      { name: "tenant_id", type: "uuid", fk: "tenants.id", tenant: true },
      { name: "project_id", type: "uuid", fk: "projects.id" },
      { name: "kind", type: "text", note: "strategy/copy/art/edit/grade..." },
      { name: "engine", type: "text", note: "M1..M13" },
      { name: "version", type: "int", note: "v1→vN por revisão" },
      { name: "payload", type: "jsonb" },
    ],
  },
  {
    name: "media_assets",
    fromDoc: true,
    purpose: "Arquivos gerados (vídeo, imagem, áudio). Referência ao storage + metadados de fidelidade.",
    columns: [
      { name: "id", type: "uuid", pk: true },
      { name: "tenant_id", type: "uuid", fk: "tenants.id", tenant: true },
      { name: "project_id", type: "uuid", fk: "projects.id" },
      { name: "kind", type: "enum(video,image,audio)" },
      { name: "storage_url", type: "text", note: "object storage" },
      { name: "fidelity", type: "numeric", note: "% objetiva vs. referência" },
      { name: "meta", type: "jsonb", note: "cor/LUFS/ruído/duração" },
    ],
  },
  {
    name: "audit_gate_logs",
    fromDoc: true,
    purpose: "Registro imutável dos 3 portões: quem/o quê aprovou, score e evidência. Trilha de compliance.",
    columns: [
      { name: "id", type: "uuid", pk: true },
      { name: "tenant_id", type: "uuid", fk: "tenants.id", tenant: true },
      { name: "project_id", type: "uuid", fk: "projects.id" },
      { name: "gate", type: "enum(brand,av,tone)" },
      { name: "score", type: "numeric", note: "fidelidade medida" },
      { name: "passed", type: "boolean" },
      { name: "decided_by", type: "uuid", fk: "users.id", note: "human-in-the-loop" },
      { name: "evidence", type: "jsonb" },
      { name: "created_at", type: "timestamptz" },
    ],
  },
]

// Microsserviços — cada um escala de forma independente
export interface ServiceDef {
  id: string
  name: string
  role: string
  scale: string
  engines?: string
}

export const SERVICES: ServiceDef[] = [
  {
    id: "gateway",
    name: "API Gateway",
    role: "Auth, rate-limit, roteamento e resolução de tenant por requisição.",
    scale: "stateless · autoscale horizontal",
  },
  {
    id: "intake",
    name: "Intake Service",
    role: "Recebe briefing texto/voz, transcreve e normaliza. Dispara o pipeline.",
    scale: "stateless · fila de entrada",
    engines: "M1",
  },
  {
    id: "creative",
    name: "Creative Service",
    role: "Roteirização e direção de arte. Orquestra os LLMs de criação.",
    scale: "stateless · autoscale por fila",
    engines: "M2–M5",
  },
  {
    id: "render",
    name: "Render Service",
    role: "Geração visual, avatares e voz. Trabalho pesado em GPU.",
    scale: "GPU pool · autoscale por profundidade da fila",
    engines: "M6–M7",
  },
  {
    id: "post",
    name: "Post Service",
    role: "Edição, color grade, motion e mix final. Pipeline de mídia (ffmpeg/GPU).",
    scale: "GPU/CPU · jobs longos",
    engines: "M8",
  },
  {
    id: "audit",
    name: "Audit Service",
    role: "Mede fidelidade objetiva e roda os 3 portões. Loop de crítica/reescrita.",
    scale: "stateless · determinístico",
    engines: "M9–M10",
  },
  {
    id: "delivery",
    name: "Delivery Service",
    role: "Adapta formatos, publica nas plataformas e coleta analytics.",
    scale: "stateless · agendado",
    engines: "M11–M13",
  },
]

// Camada de dados e infra
export interface InfraItem {
  id: string
  name: string
  tech: string
  role: string
}

export const INFRA: InfraItem[] = [
  {
    id: "db",
    name: "Banco relacional",
    tech: "PostgreSQL",
    role: "Fonte de verdade transacional. Isolamento por tenant + RLS (row-level security).",
  },
  {
    id: "queue",
    name: "Fila de jobs",
    tech: "Redis / SQS",
    role: "Desacopla o pipeline. Cada módulo consome sua fila e escala sozinho.",
  },
  {
    id: "storage",
    name: "Object storage",
    tech: "S3 / Blob",
    role: "Vídeos, imagens e áudio. URLs assinadas e versionamento por asset.",
  },
  {
    id: "gpu",
    name: "Pool de GPU",
    tech: "GPU autoscale",
    role: "Geração visual/áudio e pós. Escala pela profundidade da fila de render.",
  },
  {
    id: "cache",
    name: "Cache / estado efêmero",
    tech: "Redis",
    role: "Sessões, rate-limit e cache de referências de marca.",
  },
  {
    id: "obs",
    name: "Observabilidade",
    tech: "OTel + logs",
    role: "Trace por projeto e por motor. SLA 99,9% monitorado ponta a ponta.",
  },
]

// Requisitos não-funcionais do documento
export const NFRS = [
  { label: "SLA", value: "99,9%", note: "disponibilidade ponta a ponta" },
  { label: "Fidelidade", value: "≥ 99%", note: "cor · brilho · ruído · volume" },
  { label: "Isolamento", value: "Multi-tenant", note: "RLS por tenant_id" },
  { label: "Conformidade", value: "LGPD", note: "consentimento de voz e rosto" },
  { label: "Acesso", value: "RBAC", note: "5 papéis · aprovação nos gates" },
  { label: "Auditoria", value: "Imutável", note: "log de todo portão" },
]

// Fluxo de dados de ponta a ponta (para o diagrama)
export const DATA_FLOW = [
  "Briefing (texto/voz)",
  "API Gateway",
  "Fila de entrada",
  "Pipeline M1–M13",
  "GPU pool",
  "Object storage",
  "Auditoria (3 portões)",
  "Publicação",
]
