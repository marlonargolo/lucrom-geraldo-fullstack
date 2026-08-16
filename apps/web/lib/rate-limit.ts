import { getRedisClient } from "@/lib/redis/redis-client"

/**
 * Rate limiter distribuído: com REDIS_HOST configurado, usa um contador
 * de janela fixa no Redis (INCR + PEXPIRE), compartilhado entre todas as
 * réplicas do processo — necessário em produção multi-instância, já que um
 * Map em memória local não é visível entre réplicas atrás de um load
 * balancer.
 *
 * Sem REDIS_HOST (ex.: desenvolvimento local sem Redis rodando), cai para
 * um Map em memória por processo — suficiente para uma única instância.
 * Erros de infraestrutura do Redis também caem pro fallback local
 * (fail-open): uma falha transitória do Redis não deve travar usuários
 * legítimos.
 *
 * Cada chamador cria seu próprio limitador (`createRateLimiter`) com janela,
 * limite e prefixo de chave próprios — usado por /api/ai/generate-ad,
 * /api/media/upload e /api/instagram/publish, cada um com seus limites.
 */
export function createRateLimiter(opts: { windowMs: number; maxRequests: number; keyPrefix: string }) {
  const { windowMs, maxRequests, keyPrefix } = opts
  const localHits = new Map<string, number[]>()

  function isRateLimitedLocal(key: string): boolean {
    const now = Date.now()
    const windowStart = now - windowMs
    const timestamps = (localHits.get(key) ?? []).filter((t) => t > windowStart)
    timestamps.push(now)
    localHits.set(key, timestamps)
    return timestamps.length > maxRequests
  }

  return async function isRateLimited(key: string): Promise<boolean> {
    const redis = getRedisClient()
    if (!redis) return isRateLimitedLocal(key)

    try {
      const redisKey = `rate-limit:${keyPrefix}:${key}`
      const current = await redis.incr(redisKey)
      if (current === 1) {
        await redis.pexpire(redisKey, windowMs)
      }
      return current > maxRequests
    } catch (err) {
      console.error(`[rate-limit:${keyPrefix}] erro no Redis, usando fallback local:`, err)
      return isRateLimitedLocal(key)
    }
  }
}
