import { IsIn, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class GenerateAvatarVideoDto {
  @IsUUID()
  tenant_id: string;

  @IsUUID()
  avatar_profile_id: string;

  @IsUUID()
  voice_profile_id: string;

  /** Texto a ser falado pelo avatar (o mesmo roteiro que pode vir do ScriptGeneratorService/Director Engine). */
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  script_text: string;

  @IsIn(['9:16', '16:9', '1:1'])
  aspect_ratio: '9:16' | '16:9' | '1:1';
}
