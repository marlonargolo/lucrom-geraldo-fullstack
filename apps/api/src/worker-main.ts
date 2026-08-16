import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { WorkerModule } from './worker.module';

/**
 * Processo separado do worker (container `worker` no docker-compose).
 * Usa createApplicationContext (sem servidor HTTP) — este processo só
 * consome as filas jobs:render:high_priority e jobs:render:standard.
 */
async function bootstrap() {
  await NestFactory.createApplicationContext(WorkerModule);
  Logger.log(
    'LUCROM Studio AI Worker iniciado — consumindo jobs:render:high_priority, jobs:render:standard e jobs-video-render',
    'Bootstrap',
  );
}

bootstrap();
