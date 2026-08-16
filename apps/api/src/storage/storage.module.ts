import { Global, Module } from '@nestjs/common';
import { StorageService } from './storage.service';

/**
 * Global: tanto o processo da API quanto o do worker precisam do storage,
 * e ambos importam este módulo dentro do mesmo AppModule (ver main.ts / worker-main.ts).
 */
@Global()
@Module({
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
