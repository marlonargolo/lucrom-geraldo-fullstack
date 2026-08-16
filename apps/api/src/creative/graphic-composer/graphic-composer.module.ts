import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GraphicComposition } from './graphic-composition.entity';
import { Tenant } from '../../tenants/tenant.entity';
import { GraphicComposerService } from './graphic-composer.service';
import { GraphicComposerController } from './graphic-composer.controller';
import { MediaAssetsModule } from '../../media-assets/media-assets.module';

@Module({
  // StorageModule é @Global() (ver storage.module.ts) — não precisa ser importado aqui.
  imports: [TypeOrmModule.forFeature([GraphicComposition, Tenant]), MediaAssetsModule],
  providers: [GraphicComposerService],
  controllers: [GraphicComposerController],
  exports: [GraphicComposerService],
})
export class GraphicComposerModule {}
