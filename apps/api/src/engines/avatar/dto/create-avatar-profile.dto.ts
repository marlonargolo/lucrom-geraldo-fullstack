import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

/**
 * `sourceAssetId` deve apontar para um `media_asset` de IMAGEM (foto/frame
 * de rosto, requisitos do HeyGen: recente, boa iluminação, rosto visível) —
 * ver `HeyGenClientService.uploadTalkingPhoto`.
 */
export class CreateAvatarProfileDto {
  @IsUUID()
  tenant_id: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name: string;

  @IsUUID()
  source_asset_id: string;

  /** id de um `consent_records` com subject_type='face', obrigatório. */
  @IsUUID()
  consent_record_id: string;
}
