import { Global, Module } from '@nestjs/common';
import { RedisService } from './redis.service';

/**
 * Global para não obrigar cada módulo consumidor (AuthModule, e futuramente
 * qualquer rate limit adicional) a reimportar — mesma decisão do DatabaseModule.
 */
@Global()
@Module({
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}
