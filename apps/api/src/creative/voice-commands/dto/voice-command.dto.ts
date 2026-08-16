import { IsOptional, IsString, IsUUID } from 'class-validator';

/**
 * O áudio em si vem via multipart (`file`, ver VoiceCommandController) —
 * este DTO cobre apenas os campos de formulário que acompanham o upload.
 */
export class InterpretVoiceCommandDto {
  @IsUUID()
  tenant_id: string;

  /** Idioma para o WhisperX (padrão: 'pt'). */
  @IsOptional()
  @IsString()
  language?: string;
}
