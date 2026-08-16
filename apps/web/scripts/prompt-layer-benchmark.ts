// Benchmark: prompt-layer.ts (1 chamada, JSON estruturado) vs. prompts soltos
// convencionais (5 chamadas separadas — hook, body, cta, visual, narração).
//
// Por quê 5 chamadas soltas como baseline? É o jeito "óbvio" de implementar
// isso sem a subcamada: cada campo do anúncio vira uma chamada de IA própria.
// Como a API é stateless, TODO o contexto do negócio (system prompt completo
// + businessType + offer + tone) precisa ser reenviado em cada uma das 5
// chamadas — é exatamente essa repetição que a subcamada elimina.
//
// Importa `buildLayeredPrompt` DIRETO do arquivo real em produção
// (lib/ai/prompt-layer.ts), então este benchmark nunca fica dessincronizado
// do prompt que a aplicação de fato envia.
//
// Como rodar (a partir de apps/web):
//   npx tsx scripts/prompt-layer-benchmark.ts
//
// Flag opcional --live: além da estimativa estática, faz as chamadas reais
// para text.pollinations.ai (grátis, sem chave) e mostra o tamanho real das
// respostas. Requer acesso à internet no ambiente onde o script roda.
//   npx tsx scripts/prompt-layer-benchmark.ts --live

import { buildLayeredPrompt, type MeiInput } from "../lib/ai/prompt-layer"

// ---------------------------------------------------------------------------
// 1) Casos de teste: 3 nichos de MEI diferentes
// ---------------------------------------------------------------------------
const NICHES: (MeiInput & { label: string })[] = [
  {
    label: "Alimentação",
    businessType: "Hamburgueria artesanal de bairro",
    offer: "Combo smash burger + batata + refri por R$25",
    tone: "Persuasivo e divertido",
  },
  {
    label: "Beleza",
    businessType: "Salão de manicure e nail design",
    offer: "Unha em gel + esmaltação em gel por R$60, primeira cliente",
    tone: "Profissional e aspiracional",
  },
  {
    label: "Serviços",
    businessType: "Eletricista residencial autônomo",
    offer: "Visita técnica + orçamento grátis para instalações e reparos",
    tone: "Direto e confiável",
  },
]

// ---------------------------------------------------------------------------
// 2) Baseline "convencional": 5 prompts soltos, um por campo do anúncio.
//    Cada um precisa restatar o contexto completo do negócio, porque a API
//    não guarda memória entre chamadas.
// ---------------------------------------------------------------------------
function buildConventionalPrompts(input: MeiInput): { field: string; prompt: string }[] {
  const tone = input.tone?.trim() || "direto e persuasivo"
  const context =
    `Você é um copywriter especialista em anúncios curtos para MEI no Brasil. ` +
    `Negócio: ${input.businessType}. Oferta: ${input.offer}. Tom: ${tone}.`

  return [
    {
      field: "hook",
      prompt: `${context} Escreva uma frase de impacto (hook) de até 3 segundos para abrir o vídeo. Responda só com a frase.`,
    },
    {
      field: "body",
      prompt: `${context} Escreva um texto curto (até 30 palavras) apresentando a oferta de forma clara. Responda só com o texto.`,
    },
    {
      field: "cta",
      prompt: `${context} Escreva uma chamada para ação (CTA) direcionando para WhatsApp ou Instagram. Responda só com a chamada.`,
    },
    {
      field: "visual_prompt",
      prompt: `${context} Escreva, em inglês, um prompt para gerar uma imagem de fundo com IA (FLUX.1/Z-Image) que combine com esse anúncio, sem texto embutido na imagem. Responda só com o prompt.`,
    },
    {
      field: "narration_text",
      prompt: `${context} Escreva o texto completo de narração para virar áudio (TTS), em português, natural, até 30 segundos de fala. Responda só com o texto.`,
    },
  ]
}

// ---------------------------------------------------------------------------
// 3) Estimativa de tokens. Heurística padrão (~4 caracteres por token em
//    português/inglês) usada por falta de tokenizer oficial do DeepSeek-V3/
//    Gemini Flash disponível offline — serve para comparação relativa entre
//    as duas abordagens, não como número exato de billing.
// ---------------------------------------------------------------------------
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

interface NicheResult {
  label: string
  layeredChars: number
  layeredTokens: number
  layeredCalls: number
  conventionalChars: number
  conventionalTokens: number
  conventionalCalls: number
}

function runNiche(input: MeiInput & { label: string }): NicheResult {
  // Subcamada: 1 chamada, system + user.
  const { systemInstruction, userInstruction } = buildLayeredPrompt(input)
  const layeredPrompt = `${systemInstruction}\n\n${userInstruction}`
  const layeredChars = layeredPrompt.length
  const layeredTokens = estimateTokens(layeredPrompt)

  // Convencional: 5 chamadas, cada uma com contexto completo repetido.
  const conventional = buildConventionalPrompts(input)
  const conventionalChars = conventional.reduce((sum, p) => sum + p.prompt.length, 0)
  const conventionalTokens = conventional.reduce((sum, p) => sum + estimateTokens(p.prompt), 0)

  return {
    label: input.label,
    layeredChars,
    layeredTokens,
    layeredCalls: 1,
    conventionalChars,
    conventionalTokens,
    conventionalCalls: conventional.length,
  }
}

function pct(reduced: number, base: number): string {
  if (base === 0) return "0%"
  return `${(((base - reduced) / base) * 100).toFixed(1)}%`
}

function printReport(results: NicheResult[]) {
  console.log("\n=== Benchmark: prompt-layer.ts vs. prompts soltos convencionais ===\n")
  console.log(
    "Nicho".padEnd(14) +
      "Chamadas".padEnd(12) +
      "Chars (layer)".padEnd(16) +
      "Chars (conv.)".padEnd(16) +
      "Tokens (layer)".padEnd(17) +
      "Tokens (conv.)".padEnd(17) +
      "Economia (tokens)",
  )
  console.log("-".repeat(110))

  let sumLayeredTokens = 0
  let sumConventionalTokens = 0
  let sumLayeredChars = 0
  let sumConventionalChars = 0

  for (const r of results) {
    sumLayeredTokens += r.layeredTokens
    sumConventionalTokens += r.conventionalTokens
    sumLayeredChars += r.layeredChars
    sumConventionalChars += r.conventionalChars

    console.log(
      r.label.padEnd(14) +
        `${r.layeredCalls} vs ${r.conventionalCalls}`.padEnd(12) +
        String(r.layeredChars).padEnd(16) +
        String(r.conventionalChars).padEnd(16) +
        String(r.layeredTokens).padEnd(17) +
        String(r.conventionalTokens).padEnd(17) +
        pct(r.layeredTokens, r.conventionalTokens),
    )
  }

  console.log("-".repeat(110))
  console.log(
    "TOTAL".padEnd(14) +
      `${results.length} vs ${results.length * 5}`.padEnd(12) +
      String(sumLayeredChars).padEnd(16) +
      String(sumConventionalChars).padEnd(16) +
      String(sumLayeredTokens).padEnd(17) +
      String(sumConventionalTokens).padEnd(17) +
      pct(sumLayeredTokens, sumConventionalTokens),
  )

  console.log(
    `\nResumo: a subcamada usa ${results.length} chamada(s) de IA no total (1 por nicho) contra ` +
      `${results.length * 5} chamadas na abordagem convencional (5 por nicho), com uma economia média de ` +
      `${pct(sumLayeredTokens, sumConventionalTokens)} nos tokens de ENTRADA estimados, além de reduzir` +
      ` a chance de rate-limit em provedores grátis (menos requisições por anúncio).`,
  )
  console.log(
    "\nObs.: a estimativa de tokens usa a heurística ~4 caracteres/token (aproximação padrão), pois o" +
      " tokenizer oficial do provedor não está disponível offline. Use --live para medir o tamanho real" +
      " das respostas via text.pollinations.ai (requer internet).",
  )
}

// ---------------------------------------------------------------------------
// 4) Modo --live (opcional): faz as chamadas reais e mede a resposta.
// ---------------------------------------------------------------------------
async function callText(prompt: string): Promise<string | null> {
  try {
    const url = `https://text.pollinations.ai/${encodeURIComponent(prompt)}?json=true`
    const res = await fetch(url)
    if (!res.ok) return null
    return (await res.text()).trim()
  } catch {
    return null
  }
}

async function runLive(input: MeiInput & { label: string }) {
  console.log(`\n--- ${input.label} (chamadas reais) ---`)

  const { systemInstruction, userInstruction } = buildLayeredPrompt(input)
  const layeredResponse = await callText(`${systemInstruction}\n\n${userInstruction}`)
  console.log(`Subcamada (1 chamada) -> resposta: ${layeredResponse ? layeredResponse.length : 0} chars`)

  const conventional = buildConventionalPrompts(input)
  let conventionalTotal = 0
  for (const p of conventional) {
    const resp = await callText(p.prompt)
    conventionalTotal += resp ? resp.length : 0
    await new Promise((r) => setTimeout(r, 700)) // respeita rate limit anônimo
  }
  console.log(`Convencional (5 chamadas) -> resposta total: ${conventionalTotal} chars`)
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------
async function main() {
  const results = NICHES.map(runNiche)
  printReport(results)

  if (process.argv.includes("--live")) {
    console.log("\n=== Modo --live: chamando text.pollinations.ai de verdade ===")
    for (const niche of NICHES) {
      await runLive(niche)
    }
  }
}

main()
