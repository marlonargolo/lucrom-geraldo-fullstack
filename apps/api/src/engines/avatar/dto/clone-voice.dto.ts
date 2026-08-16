import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

/**
 * `sourceAssetId` deve apontar para um `media_asset` de ÁUDIO (ou vídeo com
 * faixa de áudio) já enviado via `POST /api/v1/media/upload` — nunca aceita
 * um binário direto neste DTO (mesmo padrão dos demais endpoints: o corpo é
 * sempre JSON, o binário sempre passa pelo fluxo de media_assets primeiro).
 */
export class CloneVoiceDto {
  @IsUUID()
  tenant_id: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name: string;

  @IsUUID()
  source_asset_id: string;

  /**
   * id de um `consent_records` com subject_type='voice', status
   * LEGAL_CONSENT_GRANTED e não expirado — obrigatório (ver
   * `AvatarOrchestratorService.assertVoiceConsent`).
   */
  @IsUUID()
  consent_record_id: string;
}
