import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsIn, IsNumber, IsOptional, IsPositive, IsString, IsUUID, ValidateNested } from 'class-validator';

/** Nichos suportados (Seção 4 da Especificação Técnica de Arquitetura). */
type NicheType = 'marcenaria' | 'farmacia' | 'mercado' | 'escritorio';

class PipelineOptionsDto {
  // ─── Opções originais (preservadas integralmente) ──────────────────────────
  @IsOptional()
  @IsBoolean()
  enable_relighting?: boolean;

  /**
   * NÃO IMPLEMENTADO neste motor: lip-sync fotorrealista é geração por IA
   * (M8 generativo / M6+M7), fora do escopo pedido ("infraestrutura verdadeira
   * sem ser generativa"). Se true, o job é aceito mas retorna aviso explícito.
   */
  @IsOptional()
  @IsBoolean()
  enable_lip_sync?: boolean;

  @IsOptional()
  @IsIn(['corporate_modern', 'word_level', 'none'])
  subtitles_style?: string;

  @IsOptional()
  @IsBoolean()
  background_denoise?: boolean;

  // ─── Etapa 1: Audio Clean & Sync ─────────────────────────────────────────
  /**
   * Ativa o pipeline completo de limpeza de áudio:
   *   • Isolamento vocal via DeepFilterNet (remove ruído de fundo).
   *   • Transcrição word-level via WhisperX (base para legendas sincronizadas).
   * Requer REPLICATE_API_TOKEN configurado.
   */
  @IsOptional()
  @IsBoolean()
  enable_audio_clean?: boolean;

  /**
   * Idioma do conteúdo falado, passado para o WhisperX.
   * Aceita códigos ISO-639-1 (ex: 'pt', 'en', 'es').
   * Padrão: 'pt'.
   */
  @IsOptional()
  @IsString()
  language?: string;

  // ─── Etapas 2+3: Video Matting + Niche Preset ────────────────────────────
  /**
   * Ativa o recorte de fundo via Robust Video Matting (RVM).
   * O modelo processa o vídeo no Replicate e retorna um composto com fundo verde sintético.
   * O chroma-key matemático (colorkey ffmpeg) converte em alpha real.
   * Exige que `niche` também seja informado para compor sobre o fundo gerado.
   */
  @IsOptional()
  @IsBoolean()
  enable_matting?: boolean;

  /**
   * Nicho comercial do vídeo — define:
   *   • O prompt de geração do fundo via Flux (Etapa 3).
   *   • O estilo visual das legendas (fonte, cor, destaque, caixa) (Etapa 4).
   *   • O perfil de compressão de áudio.
   *
   * Valores disponíveis (Seção 4 da Especificação):
   *   'marcenaria' — Oficina moderna, iluminação quente, destaques em amarelo/laranja.
   *   'farmacia'   — Ambiente clean, tons claros, destaques em azul/verde.
   *   'mercado'    — Gastronômico/artesanal, fonte bold de alto contraste.
   *   'escritorio' — Sala de reunião, tipografia minimalista com itálico animado.
   */
  @IsOptional()
  @IsIn(['marcenaria', 'farmacia', 'mercado', 'escritorio'] as NicheType[])
  niche?: NicheType;

  // ─── Dimensões de saída ───────────────────────────────────────────────────
  /** Largura do vídeo de saída em pixels (padrão: dimensão original). */
  @IsOptional()
  @IsNumber()
  @IsPositive()
  output_width?: number;

  /** Altura do vídeo de saída em pixels (padrão: dimensão original). */
  @IsOptional()
  @IsNumber()
  @IsPositive()
  output_height?: number;
}

class BrandKitDto {
  @IsArray()
  @IsString({ each: true })
  palette: string[]; // hex

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  forbidden_words?: string[];
}

/**
 * Contrato base idêntico ao Blueprint Executivo Volume 3 §2:
 * POST /api/v1/engines/m8/render — { tenant_id, script_id, raw_video_key, pipeline_options }.
 *
 * Campos abaixo do pipeline_options são extensão necessária para o motor
 * REAL determinístico (Color Matching + Audit Gates) pedido pelo usuário —
 * o contrato original não previa como informar a referência de qualidade
 * nem o texto/brand kit usados pelos gates.
 *
 * Etapas 1-3 (generativas via Replicate) são ativadas opcionalmente por
 * flags no pipeline_options — o pipeline original não é alterado quando
 * as flags estão ausentes.
 */
export class RenderM8Dto {
  @IsUUID()
  tenant_id: string;

  @IsUUID()
  script_id: string;

  /** s3_key de um media_asset já enviado via POST /api/v1/media-assets/upload. */
  @IsString()
  raw_video_key: string;

  @ValidateNested()
  @Type(() => PipelineOptionsDto)
  pipeline_options: PipelineOptionsDto;

  /** s3_key do vídeo/imagem de referência ("molde") — necessário para o Gate 2 medir fidelidade de verdade. */
  @IsOptional()
  @IsString()
  reference_video_key?: string;

  /** Texto do roteiro/copy da peça — necessário para os Gates 1 e 3. */
  @IsOptional()
  @IsString()
  script_text?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => BrandKitDto)
  brand_kit?: BrandKitDto;
}
