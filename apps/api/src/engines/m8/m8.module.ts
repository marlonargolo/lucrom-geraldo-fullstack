import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RenderJob } from './render-job.entity';
import { MediaAsset } from '../../media-assets/media-asset.entity';
import { Tenant } from '../../tenants/tenant.entity';
import { M8Service } from './m8.service';
import { M8Controller } from './m8.controller';
import { QueueModule } from '../../queue/queue.module';

@Module({
  imports: [TypeOrmModule.forFeature([RenderJob, MediaAsset, Tenant]), QueueModule],
  providers: [M8Service],
  controllers: [M8Controller],
  exports: [M8Service],
})
export class M8Module {}
