// Erro dedicado pra "cota mensal do plano esgotada" (402 Payment Required).
// Componentes que chamam rotas protegidas por cota (ex.: generate-ad-client.ts)
// lançam este erro específico em vez de um Error genérico, pra quem chama
// poder fazer `if (e instanceof QuotaExceededError)` e abrir o modal de
// upgrade em vez de só mostrar texto de erro inline.

export interface QuotaInfo {
  used: number
  limit: number
  plan: "CREATOR" | "PRO" | "ENTERPRISE"
}

export class QuotaExceededError extends Error {
  readonly quota: QuotaInfo | null

  constructor(message: string, quota: QuotaInfo | null = null) {
    super(message)
    this.name = "QuotaExceededError"
    this.quota = quota
  }
}
