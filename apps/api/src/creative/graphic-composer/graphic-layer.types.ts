/**
 * Módulo Arquitetural — Ajuste Rápido Humano.
 *
 * Modelo de artefato estruturado em camadas (`GraphicLayer[]`), guardado ao
 * lado do PNG achatado em `GraphicComposition.layers`. Existe pra que
 * alterações determinísticas (fonte, tamanho, cor, posição, opacidade, troca
 * de ativo, visibilidade) NUNCA precisem de uma nova chamada de IA — só uma
 * nova renderização Puppeteer/HTML, que é determinística e barata.
 *
 * Separação canônica (ver doc do módulo):
 *   • Operações generativas (criar imagem, roteiro, copy...) → continuam IA.
 *   • Operações determinísticas (as listadas acima) → GraphicComposerService.updateLayers(),
 *     sem tocar em nenhum provedor de IA.
 */

export type GraphicLayerKind = 'background' | 'image' | 'logo' | 'headline' | 'subtitle' | 'cta' | 'decorative';

export type LayerAlign = 'left' | 'center' | 'right';
export type LayerVerticalPosition = 'top' | 'center' | 'bottom';

/**
 * Propriedades editáveis de uma camada. Todas opcionais — quando ausente, o
 * `slide-template.ts` cai no valor proporcional padrão (o mesmo cálculo que
 * já existia antes deste módulo, preservando a composição original de
 * `compose()` pixel a pixel enquanto nada for ajustado).
 */
export interface GraphicLayerStyle {
  /** Cor em hex. Para texto: cor da fonte. Para background: cor sólida (ignora gradiente da paleta se definido). */
  color?: string;
  /** Tamanho de fonte em px absoluto (só p/ headline|subtitle|cta). */
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: number;
  align?: LayerAlign;
  /** Posição vertical do bloco de texto dentro do slide. */
  verticalPosition?: LayerVerticalPosition;
  /** 0 a 1. */
  opacity?: number;
  /** Espaçamento extra abaixo do elemento, em px. */
  spacingBottom?: number;
  /** Mostra/oculta a camada sem apagar seu conteúdo (ex.: ocultar logo). */
  visible?: boolean;
  /** URL do ativo (image/logo/background como imagem) — troca de ativo, sem gerar novo. */
  assetUrl?: string;
}

export interface GraphicLayer {
  /** Estável entre renderizações — é a chave usada pelo Ajuste Rápido pra saber o que editar. */
  id: string;
  kind: GraphicLayerKind;
  /** Texto do elemento (headline/subtitle/cta). Editável diretamente — não é operação generativa. */
  content?: string;
  style: GraphicLayerStyle;
}

/** Um item por slide — carrossel tem N; arte estática tem 1. */
export interface GraphicSlideLayers {
  slide_index: number;
  elements: GraphicLayer[];
}

/**
 * Snapshot de uma versão anterior, guardado em `GraphicComposition.history`
 * a cada `updateLayers()` bem-sucedido — ver seção 9 do doc do módulo
 * (versionamento). Permite desfazer voltando a um `output_asset_ids` já
 * renderizado, sem re-renderizar.
 */
export interface GraphicCompositionSnapshot {
  version: number;
  layers: GraphicSlideLayers[];
  output_asset_ids: string[];
  /** 'human' = Ajuste Rápido (determinístico) · 'ai' = reservado p/ futura regeneração generativa parcial. */
  source: 'human' | 'ai';
  note?: string;
  created_at: string;
}
