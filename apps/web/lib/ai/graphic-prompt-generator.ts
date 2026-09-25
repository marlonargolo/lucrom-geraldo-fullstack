// Camada que permite a tela de "Peças" ter um único campo de prompt
// (como a referência) em vez do formulário Título/Corpo/CTA por slide.
//
// Não é um provedor novo: reusa o mesmo endpoint de texto anônimo e grátis
// já usado em generateScenesFromTopic (text.pollinations.ai), só que com um
// formato de saída (headline/body/cta) compatível com
// `graphicComposerClient.compose()` — nada aqui fala com o backend de IA
// paga (DeepSeek/Kling/MiniMax) do outro produto (LUCROM Studio AI).
//
// Se a IA de texto falhar ou vier vazia, cai num gerador local (nunca falha),
// igual ao padrão já usado no resto do projeto.

const TEXT_ENDPOINT = "https://text.pollinations.ai"

export interface GraphicSlideContent {
  title: string
  body: string
  footer: string
}

function timeout(ms: number, signal?: AbortSignal): Promise<never> {
  return new Promise((_, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms)
    signal?.addEventListener("abort", () => {
      clearTimeout(t)
      reject(new Error("abort"))
    })
  })
}

async function callText(prompt: string, signal?: AbortSignal): Promise<string | null> {
  const url = `${TEXT_ENDPOINT}/${encodeURIComponent(prompt)}`
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = (await Promise.race([fetch(url, { signal }), timeout(15000, signal)])) as Response
      if (!res.ok) continue
      const text = (await res.text()).trim()
      if (text.startsWith("{") && text.includes('"error"')) continue
      if (text.length > 0) return text
    } catch {
      /* tenta de novo */
    }
  }
  return null
}

function stripCodeFence(text: string): string {
  const trimmed = text.trim()
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  return fenced ? fenced[1].trim() : trimmed
}

/** Extrai um array de {title,body,footer} de uma resposta JSON da IA. Retorna null se o shape não bater. */
function parseSlides(raw: string): GraphicSlideContent[] | null {
  try {
    const data = JSON.parse(stripCodeFence(raw))
    const list = Array.isArray(data) ? data : Array.isArray(data.slides) ? data.slides : null
    if (!list) return null
    const slides = list
      .map((item: Record<string, unknown>) => ({
        title: String(item.title ?? item.headline ?? "").trim().slice(0, 200),
        body: String(item.body ?? item.subtitle ?? "").trim().slice(0, 600),
        footer: String(item.footer ?? item.cta ?? "").trim().slice(0, 120),
      }))
      .filter((s: GraphicSlideContent) => s.title.length > 0)
    return slides.length > 0 ? slides : null
  } catch {
    return null
  }
}

/** Gerador de reserva 100% local — nunca falha, sem rede. */
function localFallback(prompt: string, slideCount: number): GraphicSlideContent[] {
  const topic = prompt.trim().replace(/[.]+$/, "")
  const base: GraphicSlideContent[] = [
    { title: topic || "Sua ideia aqui", body: "Edite este texto para contar sua história.", footer: "Saiba mais" },
    { title: "Por que isso importa", body: "Explique o benefício principal em uma frase direta.", footer: "Continue" },
    { title: "Como funciona", body: "Descreva o passo a passo de forma simples.", footer: "Veja como" },
    { title: "Resultado", body: "Mostre a transformação ou o resultado esperado.", footer: "Confira" },
    { title: "Chamada final", body: "Convide a pessoa a agir agora.", footer: "Fale conosco" },
  ]
  return base.slice(0, Math.max(1, Math.min(slideCount, base.length)))
}

/**
 * Gera o conteúdo de 1 (arte única) ou N (carrossel) slides a partir de um
 * único prompt em texto livre, pronto para `graphicComposerClient.compose()`.
 */
export async function generateSlidesFromPrompt(
  prompt: string,
  kind: "static_art" | "carousel",
  slideCount = 5,
  signal?: AbortSignal,
): Promise<{ slides: GraphicSlideContent[]; usedAI: boolean }> {
  const n = kind === "static_art" ? 1 : Math.max(2, Math.min(slideCount, 8))

  const instruction =
    kind === "static_art"
      ? `Crie o conteúdo de UMA peça gráfica (arte única) para redes sociais, em português brasileiro, sobre: "${prompt}". ` +
        `Responda EXCLUSIVAMENTE em JSON válido, sem markdown, no formato: ` +
        `{"slides":[{"title":"...","body":"...","footer":"..."}]}, com exatamente 1 item. ` +
        `"title" no máximo 10 palavras, "body" no máximo 25 palavras, "footer" é uma chamada curta (CTA) de até 6 palavras.`
      : `Crie o conteúdo de um carrossel de ${n} slides para redes sociais, em português brasileiro, sobre: "${prompt}". ` +
        `Responda EXCLUSIVAMENTE em JSON válido, sem markdown, no formato: ` +
        `{"slides":[{"title":"...","body":"...","footer":"..."}]}, com exatamente ${n} itens. ` +
        `Cada "title" no máximo 8 palavras, "body" no máximo 22 palavras. O último slide deve ter uma chamada de ação clara no "footer".`

  const text = await callText(instruction, signal)
  if (text) {
    const slides = parseSlides(text)
    if (slides && slides.length > 0) return { slides: slides.slice(0, n), usedAI: true }
  }
  return { slides: localFallback(prompt, n), usedAI: false }
}
