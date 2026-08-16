import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiTokenGuard } from '../common/guards/api-token.guard';
import { MediaAssetsService } from './media-assets.service';

@UseGuards(ApiTokenGuard)
@Controller('api/v1/media-assets')
export class MediaAssetsController {
  constructor(private readonly assets: MediaAssetsService) {}

  /**
   * Upload do vídeo/imagem bruto que será referenciado depois por `raw_video_key`
   * no POST /api/v1/engines/m8/render. Sem isso, o cliente não tem como colocar
   * o binário no S3 antes de pedir o render.
   */
  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 500 * 1024 * 1024 } }))
  async upload(@UploadedFile() file: Express.Multer.File, @Body('tenant_id') tenantId: string) {
    if (!file) throw new BadRequestException('Campo "file" (multipart/form-data) é obrigatório.');
    if (!tenantId) throw new BadRequestException('Campo "tenant_id" é obrigatório.');

    const asset = await this.assets.uploadAndRegister({
      tenantId,
      buffer: file.buffer,
      contentType: file.mimetype,
      fileType: file.mimetype,
      engineSource: 'UPLOAD',
      extraMetadata: { original_filename: file.originalname },
    });
    return asset;
  }

  @Get('tenant/:tenantId')
  findByTenant(@Param('tenantId') tenantId: string) {
    return this.assets.findByTenant(tenantId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Query('tenantId', new ParseUUIDPipe()) tenantId: string) {
    const asset = await this.assets.findOneOrFail(id, tenantId);
    const url = await this.assets.presignedUrlFor(asset);
    return { ...asset, download_url: url };
  }
}
