import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

/**
 * Onboarding único da "Identidade Digital Reutilizável": recebe as duas
 * amostras (áudio para clonagem de voz + vídeo para detecção de rosto), já
 * enviadas anteriormente via `POST /api/v1/media/upload` (nunca binário
 * direto neste DTO — mesmo padrão de `CloneVoiceDto`/`CreateAvatarProfileDto`).
 *
 * Este DTO NÃO duplica a lógica de `AvatarOrchestratorService` — apenas
 * empacota as DUAS chamadas que hoje o cliente teria que fazer em sequência
 * (`POST .../voices` e `POST .../profiles`) numa única requisição.
 */
export class SetupDigitalTwinDto {
  @IsUUID()
  tenant_id: string;

  /** Nome do perfil, usado tanto no voice_profile quanto no avatar_profile (ex.: "Identidade principal"). */
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name: string;

  /** `media_asset` de ÁUDIO (ou vídeo com faixa de áudio) já enviado — amostra para a clonagem de voz (MiniMax). */
  @IsUUID()
  voice_source_asset_id: string;

  /** id de um `consent_records` com subject_type='voice', obrigatório (Seção 12). */
  @IsUUID()
  voice_consent_record_id: string;

  /** `media_asset` de VÍDEO já enviado — amostra para detecção de rosto (Kling). */
  @IsUUID()
  avatar_source_asset_id: string;

  /** id de um `consent_records` com subject_type='face', obrigatório (Seção 12). */
  @IsUUID()
  face_consent_record_id: string;
}
