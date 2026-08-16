import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { QUEUE_RENDER_HIGH_PRIORITY, QUEUE_RENDER_STANDARD, QUEUE_VIDEO_RENDER, QUEUE_AVATAR_RENDER } from './queue.constants';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get('redis.host'),
          port: config.get('redis.port'),
        },
      }),
    }),
    BullModule.registerQueue(
      { name: QUEUE_RENDER_HIGH_PRIORITY },
      { name: QUEUE_RENDER_STANDARD },
      { name: QUEUE_VIDEO_RENDER },
      { name: QUEUE_AVATAR_RENDER },
    ),
  ],
  exports: [BullModule],
})
export class QueueModule {}
