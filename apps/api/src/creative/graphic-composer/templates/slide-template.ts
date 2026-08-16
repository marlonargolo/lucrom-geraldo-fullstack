/**
 * Gera o HTML de um slide (carrossel ou arte estática) com tipografia limpa
 * e regras visuais de marca (paleta do brand kit). Sem framework de template
 * — string interpolada é suficiente e evita dependência extra, seguindo o
 * padrão do restante do projeto (ver ReplicateClientService, sem SDK).
 *
 * Regras visuais aplicadas (brand compliance mínima):
 *   • `palette[0]` = cor de fundo (ou gradiente com palette[1] se houver 2ª cor).
 *   • `palette[2]` (ou branco, se ausente) = cor do texto — sempre com contraste alto.
 *   • Fonte definida por `fontFamily`, com fallback para uma pilha de sans-serif segura.
 *   • Título grande e body em peso menor — hierarquia tipográfica clara.
 *   • Rodapé com contador de slide (para carrossel) no canto inferior.
 */
export interface SlideTemplateParams {
  width: number;
  height: number;
  title?: string;
  body?: string;
  footer?: string;
  palette: string[];
  fontFamily?: string;
  logoUrl?: string;
  slideIndex?: number;
  slideTotal?: number;
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ─── Módulo Ajuste Rápido Humano — renderização a partir de camadas ────────
//
// Tudo abaixo é ADITIVO: `buildSlideHtml` acima continua exatamente como
// era, byte a byte, e segue sendo usada por `GraphicComposerService.compose()`
// pra não arriscar mudar o resultado visual de nenhuma peça já gerada.
//
// `renderSlideFromLayers` é o novo caminho, usado só por
// `GraphicComposerService.updateLayers()` (edição determinística pós-geração):
// em vez de title/body/footer fixos, recebe a lista de `GraphicLayer` já
// mesclada com os ajustes do usuário e desenha cada camada respeitando seu
// `style` — caindo no MESMO cálculo proporcional de `buildSlideHtml` (fonte,
// posição, cor) sempre que uma propriedade não foi explicitamente ajustada,
// pra manter a identidade visual original enquanto nada for tocado.

import { GraphicLayer, GraphicLayerStyle } from '../graphic-layer.types';

/** Constrói a lista de camadas "de nascença" de um slide — chamada por `compose()` logo após renderizar o PNG inicial. */
export function buildDefaultLayers(params: {
  title?: string;
  body?: string;
  footer?: string;
  palette: string[];
  fontFamily?: string;
  logoUrl?: string;
}): GraphicLayer[] {
  const { title = '', body = '', footer = '', palette, fontFamily, logoUrl } = params;
  const bgPrimary = palette[0] ?? '#111111';
  const bgSecondary = palette[1] ?? bgPrimary;
  const textColor = palette[2] ?? '#FFFFFF';

  const layers: GraphicLayer[] = [
    {
      id: 'background',
      kind: 'background',
      style: { color: bgPrimary, visible: true, ...(bgSecondary !== bgPrimary ? { assetUrl: undefined } : {}) },
    },
    {
      id: 'headline',
      kind: 'headline',
      content: title,
      style: { color: textColor, fontFamily, align: 'left', verticalPosition: 'center', opacity: 1, visible: true },
    },
    {
      id: 'subtitle',
      kind: 'subtitle',
      content: body,
      style: { color: textColor, fontFamily, align: 'left', opacity: 0.92, visible: true },
    },
    {
      id: 'cta',
      kind: 'cta',
      content: footer,
      style: { color: textColor, fontFamily, align: 'left', opacity: 0.85, visible: true },
    },
  ];

  if (logoUrl) {
    layers.push({ id: 'logo', kind: 'logo', style: { assetUrl: logoUrl, visible: true, opacity: 1 } });
  }

  return layers;
}

function findLayer(layers: GraphicLayer[], kind: string): GraphicLayer | undefined {
  return layers.find((l) => l.kind === kind);
}

export interface RenderFromLayersParams {
  width: number;
  height: number;
  layers: GraphicLayer[];
  fontFamily?: string;
  slideIndex?: number;
  slideTotal?: number;
}

/**
 * Equivalente a `buildSlideHtml`, mas orientado a camadas — cada `style`
 * ausente cai no mesmo valor proporcional que `buildSlideHtml` já usava,
 * então uma peça recém-criada (sem nenhum ajuste humano ainda) renderiza
 * IDÊNTICA à versão original antes de qualquer edição.
 */
export function renderSlideFromLayers(params: RenderFromLayersParams): string {
  const { width, height, layers, fontFamily: fallbackFontFamily, slideIndex, slideTotal } = params;
  const defaultFontFamily = fallbackFontFamily ?? "'Helvetica Neue', Helvetica, Arial, sans-serif";

  const bg = findLayer(layers, 'background');
  const headline = findLayer(layers, 'headline');
  const subtitle = findLayer(layers, 'subtitle');
  const cta = findLayer(layers, 'cta');
  const logo = findLayer(layers, 'logo');

  const bgColor = bg?.style.color ?? '#111111';
  const background = bg?.style.assetUrl ? `url(${escapeHtml(bg.style.assetUrl)}) center/cover no-repeat` : bgColor;

  const vPos = (s?: GraphicLayerStyle) =>
    s?.verticalPosition === 'top' ? 'flex-start' : s?.verticalPosition === 'bottom' ? 'flex-end' : 'center';

  const counterHtml =
    slideIndex != null && slideTotal != null ? `<div class="counter">${slideIndex + 1} / ${slideTotal}</div>` : '';

  const logoVisible = logo && logo.style.visible !== false && logo.style.assetUrl;
  const logoHtml = logoVisible
    ? `<img class="logo" style="opacity:${logo!.style.opacity ?? 1}" src="${escapeHtml(logo!.style.assetUrl!)}" />`
    : '';

  const textBlock = (layer: GraphicLayer | undefined, cls: string, defaultSizeRatio: number, weight: number) => {
    if (!layer || layer.style.visible === false || !layer.content) return '';
    const size = layer.style.fontSize ?? Math.round(width * defaultSizeRatio);
    const color = layer.style.color ?? '#FFFFFF';
    const opacity = layer.style.opacity ?? 1;
    const align = layer.style.align ?? 'left';
    const family = layer.style.fontFamily || defaultFontFamily;
    const marginBottom = layer.style.spacingBottom ?? Math.round(width * 0.035);
    return `<div class="${cls}" style="font-size:${size}px;font-weight:${weight};color:${color};opacity:${opacity};text-align:${align};font-family:${family};margin-bottom:${marginBottom}px;">${escapeHtml(layer.content)}</div>`;
  };

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    width: ${width}px;
    height: ${height}px;
    background: ${background};
    font-family: ${defaultFontFamily};
    overflow: hidden;
  }
  .slide {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: ${vPos(headline?.style)};
    padding: ${Math.round(width * 0.09)}px;
    position: relative;
  }
  .headline { line-height: 1.12; letter-spacing: -0.01em; word-break: break-word; }
  .subtitle { line-height: 1.4; word-break: break-word; white-space: pre-wrap; }
  .cta { position: absolute; left: ${Math.round(width * 0.09)}px; bottom: ${Math.round(height * 0.06)}px; letter-spacing: 0.02em; text-transform: uppercase; }
  .counter {
    position: absolute;
    right: ${Math.round(width * 0.09)}px;
    bottom: ${Math.round(height * 0.06)}px;
    font-size: ${Math.round(width * 0.028)}px;
    font-weight: 600;
    opacity: 0.75;
    color: ${headline?.style.color ?? '#FFFFFF'};
  }
  .logo {
    position: absolute;
    top: ${Math.round(height * 0.05)}px;
    right: ${Math.round(width * 0.09)}px;
    max-width: ${Math.round(width * 0.18)}px;
    max-height: ${Math.round(width * 0.18)}px;
    object-fit: contain;
  }
</style>
</head>
<body>
  <div class="slide">
    ${logoHtml}
    ${textBlock(headline, 'headline', 0.075, headline?.style.fontFamily ? 700 : 800)}
    ${textBlock(subtitle, 'subtitle', 0.038, 400)}
    ${textBlock(cta, 'cta', 0.028, 600)}
    ${counterHtml}
  </div>
</body>
</html>`;
}

export function buildSlideHtml(params: SlideTemplateParams): string {
  const {
    width,
    height,
    title = '',
    body = '',
    footer = '',
    palette,
    fontFamily = "'Helvetica Neue', Helvetica, Arial, sans-serif",
    logoUrl,
    slideIndex,
    slideTotal,
  } = params;

  const bgPrimary = palette[0] ?? '#111111';
  const bgSecondary = palette[1] ?? bgPrimary;
  const textColor = palette[2] ?? '#FFFFFF';

  const background =
    bgPrimary === bgSecondary
      ? bgPrimary
      : `linear-gradient(160deg, ${bgPrimary} 0%, ${bgSecondary} 100%)`;

  const counterHtml =
    slideIndex != null && slideTotal != null
      ? `<div class="counter">${slideIndex + 1} / ${slideTotal}</div>`
      : '';

  const logoHtml = logoUrl ? `<img class="logo" src="${escapeHtml(logoUrl)}" />` : '';

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    width: ${width}px;
    height: ${height}px;
    background: ${background};
    font-family: ${fontFamily};
    overflow: hidden;
  }
  .slide {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: ${Math.round(width * 0.09)}px;
    color: ${textColor};
  }
  .title {
    font-size: ${Math.round(width * 0.075)}px;
    font-weight: 800;
    line-height: 1.12;
    letter-spacing: -0.01em;
    margin-bottom: ${Math.round(width * 0.035)}px;
    word-break: break-word;
  }
  .body {
    font-size: ${Math.round(width * 0.038)}px;
    font-weight: 400;
    line-height: 1.4;
    opacity: 0.92;
    word-break: break-word;
    white-space: pre-wrap;
  }
  .footer {
    position: absolute;
    left: ${Math.round(width * 0.09)}px;
    bottom: ${Math.round(height * 0.06)}px;
    font-size: ${Math.round(width * 0.028)}px;
    font-weight: 600;
    opacity: 0.85;
    letter-spacing: 0.02em;
    text-transform: uppercase;
  }
  .counter {
    position: absolute;
    right: ${Math.round(width * 0.09)}px;
    bottom: ${Math.round(height * 0.06)}px;
    font-size: ${Math.round(width * 0.028)}px;
    font-weight: 600;
    opacity: 0.75;
  }
  .logo {
    position: absolute;
    top: ${Math.round(height * 0.05)}px;
    right: ${Math.round(width * 0.09)}px;
    max-width: ${Math.round(width * 0.18)}px;
    max-height: ${Math.round(width * 0.18)}px;
    object-fit: contain;
  }
</style>
</head>
<body>
  <div class="slide">
    ${logoHtml}
    <div class="title">${escapeHtml(title)}</div>
    <div class="body">${escapeHtml(body)}</div>
    <div class="footer">${escapeHtml(footer)}</div>
    ${counterHtml}
  </div>
</body>
</html>`;
}
