import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { ReplicateClientService } from './replicate-client.service';

/**
 * Etapa 3 da Especificação Técnica de Arquitetura — Preset por Nicho:
 * "Inserção de cenário profissional e iluminação adaptativa."
 * Tecnologias: Generative Backgrounds (Flux/IC-Light) com presets comerciais.
 *
 * Gera a imagem de fundo para cada nicho do mercado brasileiro usando o
 * modelo Flux no Replicate, com prompts calibrados por segmento.
 * A imagem gerada é depois usada pelo VideoMattingService (Etapa 2) na
 * composição chroma-key do recorte sobre o fundo sintético.
 *
 * Presets suportados (Seção 4 da Especificação):
 *   marcenaria  — Oficina moderna, iluminação quente, acabamentos em madeira
 *   farmacia    — Ambiente clean, tons claros, prateleiras organizadas
 *   mercado     — Gastronômico/artesanal, balcão iluminado
 *   escritorio  — Sala de reunião moderna, LED, fundo desfocado
 */

export type NicheType = 'marcenaria' | 'farmacia' | 'mercado' | 'escritorio';

export interface SubtitleStyle {
  fontColor: string;       // hex, cor principal do texto
  highlightColor: string;  // hex, cor da palavra atual em destaque
  bgColor: string;         // hex com alpha representado como '0xRRGGBBAA'
  fontSize: number;        // px
  fontStyle: 'normal' | 'bold' | 'italic';
  position: 'bottom' | 'center'; // posição vertical no frame
  borderRadius: number;    // usado no box do drawtext (ffmpeg boxborderw)
  boxEnabled: boolean;     // se true, ativa box=1 no drawtext
}

export interface AudioConfig {
  /** Boost de graves (BassBoost) para trilha dinâmica. */
  bassBoost: boolean;
  /** Equalização para alta clareza vocal. */
  highClarity: boolean;
  /** Compressão dinâmica ajustada (compand ffmpeg) para nicho. */
  compressionLabel: string;
}

export interface NicheConfig {
  niche: NicheType;
  backgroundPrompt: string;
  subtitleStyle: SubtitleStyle;
  audioConfig: AudioConfig;
}

/** Tabela de presets por nicho — Seção 4 da Especificação Técnica. */
const NICHE_PRESETS: Record<NicheType, NicheConfig> = {
  marcenaria: {
    niche: 'marcenaria',
    backgroundPrompt:
      'A modern woodworking studio, warm lighting, wooden finishing surfaces, ' +
      'lathe and tools in the background, professional workshop, soft bokeh, ' +
      'amber and orange tones, 4K photorealistic interior photography',
    subtitleStyle: {
      fontColor: '#FFFFFF',
      highlightColor: '#FF9000',
      bgColor: '0x00000080',
      fontSize: 52,
      fontStyle: 'bold',
      position: 'bottom',
      borderRadius: 6,
      boxEnabled: true,
    },
    audioConfig: {
      bassBoost: false,
      highClarity: false,
      compressionLabel: 'suave-grave',
    },
  },

  farmacia: {
    niche: 'farmacia',
    backgroundPrompt:
      'A clean modern pharmacy interior, light tones, soft diffuse lighting, ' +
      'organized white shelves with products, clinical yet welcoming ambiance, ' +
      'blue and green accents, 4K photorealistic commercial photography',
    subtitleStyle: {
      fontColor: '#FFFFFF',
      highlightColor: '#00B4D8',
      bgColor: '0x00000066',
      fontSize: 48,
      fontStyle: 'normal',
      position: 'bottom',
      borderRadius: 8,
      boxEnabled: true,
    },
    audioConfig: {
      bassBoost: false,
      highClarity: true,
      compressionLabel: 'institucional-neutra',
    },
  },

  mercado: {
    niche: 'mercado',
    backgroundPrompt:
      'A vibrant artisan bakery and market counter, warm illuminated display case, ' +
      'fresh bread and pastries, rustic wood and tile background, ' +
      'gastronomy commercial atmosphere, 4K photorealistic food photography lighting',
    subtitleStyle: {
      fontColor: '#FFFFFF',
      highlightColor: '#FFFFFF',
      bgColor: '0x00000099',
      fontSize: 56,
      fontStyle: 'bold',
      position: 'bottom',
      borderRadius: 0,
      boxEnabled: true,
    },
    audioConfig: {
      bassBoost: true,
      highClarity: false,
      compressionLabel: 'dinamica-alegre',
    },
  },

  escritorio: {
    niche: 'escritorio',
    backgroundPrompt:
      'A modern corporate meeting room, LED ceiling lighting, clean minimalist design, ' +
      'slightly blurred background, glass walls, neutral tones, professional business interior, ' +
      '4K photorealistic architectural photography',
    subtitleStyle: {
      fontColor: '#FFFFFF',
      highlightColor: '#E0E0E0',
      bgColor: '0x00000060',
      fontSize: 46,
      fontStyle: 'italic',
      position: 'bottom',
      borderRadius: 4,
      boxEnabled: false,
    },
    audioConfig: {
      bassBoost: false,
      highClarity: true,
      compressionLabel: 'corporativa-limpa',
    },
  },
};

@Injectable()
export class NichePresetService {
  private readonly logger = new Logger(NichePresetService.name);
  private readonly fluxModel: string;

  constructor(
    private readonly replicate: ReplicateClientService,
    private readonly config: ConfigService,
  ) {
    this.fluxModel =
      this.config.get<string>('generative.models.flux') ??
      'black-forest-labs/flux-schnell';
  }

  /** Retorna a configuração (prompts + estilos) para o nicho informado. */
  getConfig(niche: NicheType): NicheConfig {
    return NICHE_PRESETS[niche] ?? NICHE_PRESETS.escritorio;
  }

  /**
   * Gera a imagem de fundo para o nicho via Flux (Replicate) e salva em disco.
   * Retorna o caminho local do arquivo PNG gerado.
   *
   * @param config    Configuração do nicho (usa `backgroundPrompt`)
   * @param width     Largura do frame de saída (adapta a proporção da geração)
   * @param height    Altura do frame de saída
   */
  async generateBackground(config: NicheConfig, width = 1080, height = 1920): Promise<string> {
    this.logger.log(`Gerando fundo para nicho "${config.niche}" (${width}x${height}) via Flux…`);

    const output = await this.replicate.run(this.fluxModel, {
      prompt: config.backgroundPrompt,
      width,
      height,
      num_inference_steps: 4,   // flux-schnell requer ≤4 passos
      output_format: 'png',
      output_quality: 95,
    });

    // O Flux retorna uma lista de URLs ou uma URL direta.
    const imageUrl: string =
      Array.isArray(output)
        ? (output as string[])[0]
        : typeof output === 'string'
        ? output
        : ((output as { url?: string })?.url ?? '');

    if (!imageUrl) {
      throw new Error(`Flux não retornou URL de imagem válida para o nicho "${config.niche}".`);
    }

    const imageBuffer = await this.replicate.downloadOutput(imageUrl);
    const outPath = path.join(os.tmpdir(), `lucrom-m8-bg-${randomUUID()}.png`);
    await fs.writeFile(outPath, imageBuffer);
    this.logger.log(`Fundo gerado: ${outPath}`);
    return outPath;
  }

  /** Remove arquivos temporários gerados por este serviço. */
  async cleanup(...paths: (string | null | undefined)[]) {
    for (const p of paths) {
      if (p) await fs.rm(p, { force: true }).catch(() => undefined);
    }
  }
}
