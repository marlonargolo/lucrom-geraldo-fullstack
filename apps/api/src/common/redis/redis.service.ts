import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Provider NestJS injetável para comandos Redis diretos (INCR/GET/DEL),
 * usado onde um contador precisa sobreviver a múltiplas réplicas atrás de
 * um load balancer — um contador em memória do processo (Map) quebraria
 * silenciosamente nesse cenário.
 *
 * Reaproveita `redis.host`/`redis.port` de configuration.ts — a mesma
 * instância Redis que o BullMQ já usa (ver QueueModule), só que aqui como
 * client de comandos diretos (INCR/GET/DEL), não como connection do BullMQ.
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis;

  private static readonly INCR_EXPIRE_SCRIPT = `
    local current = redis.call('INCR', KEYS[1])
    if current == 1 then
      redis.call('PEXPIRE', KEYS[1], ARGV[1])
    end
    return current
  `;

  constructor(private readonly config: ConfigService) {
    this.client = new Redis({
      host: this.config.get<string>('redis.host'),
      port: this.config.get<number>('redis.port'),
      maxRetriesPerRequest: 3,
      lazyConnect: false,
    });
    this.client.on('error', (err) => {
      this.logger.error(`Erro de conexão com Redis: ${err.message}`);
    });
  }

  /**
   * Incremento atômico com janela fixa via script Lua (INCR+PEXPIRE numa
   * única chamada) — evita a janela de corrida que um INCR seguido de um
   * EXPIRE separado teria sob concorrência alta. Usado pelo rate limit de
   * login em `AuthService.login`.
   */
  async incrWithWindowMs(key: string, windowMs: number): Promise<number> {
    const result = await this.client.eval(RedisService.INCR_EXPIRE_SCRIPT, 1, key, String(windowMs));
    return result as number;
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  /** SET com expiração em milissegundos — usado para estados com TTL (ex.: circuit breaker aberto). */
  async setWithTtlMs(key: string, value: string, ttlMs: number): Promise<void> {
    await this.client.set(key, value, 'PX', ttlMs);
  }

  async pttl(key: string): Promise<number> {
    return this.client.pttl(key);
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  /** Health check real — pode ser usado por um /health mais completo no futuro. */
  async ping(): Promise<boolean> {
    try {
      return (await this.client.ping()) === 'PONG';
    } catch {
      return false;
    }
  }

  onModuleDestroy() {
    this.client.disconnect();
  }
}
