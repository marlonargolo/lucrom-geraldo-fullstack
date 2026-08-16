// Proxy server-side pro Director Engine real (apps/api/src/engines/director/*).
//
// Por que um proxy em vez do frontend chamar o backend direto: as rotas do
// Director Engine usam ApiTokenGuard (um token estático de servidor, não um
// JWT de usuário) — se o navegador chamasse essas rotas direto, precisaria
// carregar esse token estático no bundle client, expondo-o a qualquer
// visitante. Em vez disso, cada Route Handler em app/api/production/*
// exige login do usuário (X-User-Token, o gate de sempre) e SÓ DEPOIS repassa
// pro backend usando o API_TOKEN guardado só no servidor.
//
// Nunca finge sucesso: erros do backend (400 de estágio errado, 404 de
// sessão inexistente, etc.) são repassados com o mesmo status, não
// mascarados como 500 genérico.

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? ""
// Correção pós-auditoria (Isolamento de Tenants): NUNCA cair pra
// NEXT_PUBLIC_API_TOKEN aqui — esse valor vai pro bundle do navegador em
// qualquer arquivo importado por um componente "use client" (foi
// exatamente isso que aconteceu em lib/api/client.ts; ver correção lá).
// Este arquivo já é 100% server-side (Route Handler), então só a variável
// sem prefixo é aceitável.
const API_TOKEN = process.env.API_TOKEN || ""

export interface ProxyResult<T = unknown> {
  ok: boolean
  status: number
  body: T
}

export async function proxyToDirectorEngine<T = unknown>(
  path: string,
  init: { method: "GET" | "POST"; body?: unknown } = { method: "GET" },
): Promise<ProxyResult<T>> {
  if (!API_BASE_URL || !API_TOKEN) {
    return {
      ok: false,
      status: 501,
      body: { error: "Backend do Director Engine não configurado neste servidor." } as T,
    }
  }

  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      method: init.method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_TOKEN}`,
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
    })
    const body = (await res.json().catch(() => null)) as T
    return { ok: res.ok, status: res.status, body }
  } catch (err) {
    console.error(`[production-proxy] falha de rede chamando ${path}:`, err)
    return {
      ok: false,
      status: 503,
      body: { error: "Backend indisponível no momento. Tente novamente." } as T,
    }
  }
}
