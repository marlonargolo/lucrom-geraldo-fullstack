import Redis from "ioredis"

/**
 * Client Redis compartilhado para uso em Route Handlers (ex.: rate limiting
 * distribuído). Reaproveita REDIS_HOST/REDIS_PORT — a mesma instância Redis
 * já usada pelo backend (apps/api) para a fila BullMQ, ver
 * apps/api/.env.example.
 *
 * Retorna null quando REDIS_HOST não está configurado, para o chamador cair
 * num fallback local (útil em desenvolvimento sem Redis rodando — mesmo
 * padrão de fallback que StorageService usa para S3/filesystem local).
 */
let client: Redis | null | undefined

export function getRedisClient(): Redis | null {
  if (client !== undefined) return client

  const host = process.env.REDIS_HOST
  if (!host) {
    client = null
    return client
  }

  client = new Redis({
    host,
    port: Number(process.env.REDIS_PORT ?? 6379),
    maxRetriesPerRequest: 1,
    lazyConnect: false,
  })
  client.on("error", (err) => {
    console.error("[redis-client] erro de conexão com Redis:", err.message)
  })
  return client
}
