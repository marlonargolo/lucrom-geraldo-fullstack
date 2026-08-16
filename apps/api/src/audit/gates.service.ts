import { Injectable } from '@nestjs/common';
import { hexToRgb } from './fidelity.service';
import type { FidelityReport } from './fidelity.service';

export interface GateCheck {
  label: string;
  ok: boolean;
  detail: string;
  weight: number; // 0..1, soma dos pesos de um gate = 1
}

export interface GateResult {
  score: number; // 0..100
  passed: boolean;
  measured: boolean; // true = derivado de sinal real, nunca de PRNG
  checks: GateCheck[];
}

const GATE_PASS_THRESHOLD = 80;

/**
 * Portões de auditoria OBJETIVOS e DETERMINÍSTICOS — mesma filosofia do
 * lib/measurement/gates.ts do frontend (versão B, a mais recente): a mesma
 * entrada sempre gera a mesma nota (reprodutível, requisito de compliance),
 * e cada nota vem com um breakdown auditável (nunca caixa-preta).
 */
@Injectable()
export class GatesService {
  /** Gate 1 — Compliance de Marca: distância de cor entre a paleta renderizada e o Brand Kit + termos proibidos. */
  evaluateBrandGate(params: {
    renderedPalette: string[];
    brandPalette: string[];
    scriptText?: string;
    forbiddenWords?: string[];
  }): GateResult {
    const checks: GateCheck[] = [];

    // Critério 1: distância euclidiana média (RGB) entre a paleta gerada e a paleta oficial da marca.
    const distances = params.renderedPalette.map((hex) => {
      const c = hexToRgb(hex);
      const best = Math.min(
        ...params.brandPalette.map((brandHex) => {
          const b = hexToRgb(brandHex);
          return Math.sqrt((c.r - b.r) ** 2 + (c.g - b.g) ** 2 + (c.b - b.b) ** 2);
        }),
      );
      return best;
    });
    const avgDistance = distances.length ? distances.reduce((a, b) => a + b, 0) / distances.length : 441; // 441 ~= distância máxima possível (branco-preto)
    const paletteScore = Math.max(0, 1 - avgDistance / 200); // tolerância de ~200 no espaço RGB
    checks.push({
      label: 'Aderência de paleta',
      ok: paletteScore >= 0.7,
      detail: `Distância média de cor: ${avgDistance.toFixed(1)} (quanto menor, mais fiel à marca).`,
      weight: 0.7,
    });

    // Critério 2: ausência de termos proibidos no texto/roteiro associado à peça.
    const forbidden = params.forbiddenWords ?? [];
    const text = (params.scriptText ?? '').toLowerCase();
    const foundForbidden = forbidden.filter((w) => text.includes(w.toLowerCase()));
    checks.push({
      label: 'Ausência de termos proibidos',
      ok: foundForbidden.length === 0,
      detail:
        foundForbidden.length === 0
          ? 'Nenhum termo da lista de restrições da marca encontrado.'
          : `Termos encontrados: ${foundForbidden.join(', ')}.`,
      weight: 0.3,
    });

    return this.finalize(checks, paletteScore);
  }

  /** Gate 2 — Qualidade Audiovisual: usa a medição REAL de fidelidade (FidelityService), nunca simulação. */
  evaluateAudiovisualGate(fidelity: FidelityReport): GateResult {
    const checks: GateCheck[] = [];

    if (!fidelity.hasReference) {
      checks.push({
        label: 'Fidelidade à referência',
        ok: false,
        detail: 'Sem vídeo/imagem de referência informado — não é possível medir fidelidade objetivamente.',
        weight: 1,
      });
      return { score: 0, passed: false, measured: false, checks };
    }

    const d = fidelity.deltas!;
    checks.push(
      { label: 'Brilho', ok: d.brightness < 0.08, detail: `Δ brilho: ${(d.brightness * 100).toFixed(1)}%`, weight: 0.35 },
      { label: 'Contraste', ok: d.contrast < 0.1, detail: `Δ contraste: ${(d.contrast * 100).toFixed(1)}%`, weight: 0.3 },
      { label: 'Saturação', ok: d.saturation < 0.1, detail: `Δ saturação: ${(d.saturation * 100).toFixed(1)}%`, weight: 0.2 },
      { label: 'Ruído (grain/flicker)', ok: d.noise < 0.12, detail: `Δ ruído: ${(d.noise * 100).toFixed(1)}%`, weight: 0.15 },
    );

    return this.finalize(checks, fidelity.score / 100, true);
  }

  /** Gate 3 — Tom de Voz & Texto: heurística real sobre o roteiro (sem PRNG). */
  evaluateToneGate(params: { scriptText: string; forbiddenWords?: string[]; requireCta?: boolean }): GateResult {
    const checks: GateCheck[] = [];
    const text = params.scriptText.trim();
    const sentences = text.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean);
    const avgSentenceLen = sentences.length
      ? sentences.reduce((a, s) => a + s.split(/\s+/).length, 0) / sentences.length
      : 0;

    checks.push({
      label: 'Frases objetivas',
      ok: avgSentenceLen > 0 && avgSentenceLen <= 22,
      detail: `Média de ${avgSentenceLen.toFixed(1)} palavras por frase (ideal ≤ 22).`,
      weight: 0.25,
    });

    const hasCaps = /\b[A-ZÀ-Ú]{5,}\b/.test(text);
    checks.push({
      label: 'Sem "gritos" (caixa alta)',
      ok: !hasCaps,
      detail: hasCaps ? 'Encontrado trecho em caixa alta — foge do tom de marca.' : 'Nenhum trecho em caixa alta.',
      weight: 0.2,
    });

    const forbidden = params.forbiddenWords ?? [];
    const lower = text.toLowerCase();
    const foundForbidden = forbidden.filter((w) => lower.includes(w.toLowerCase()));
    checks.push({
      label: 'Ausência de vieses/termos proibidos',
      ok: foundForbidden.length === 0,
      detail:
        foundForbidden.length === 0 ? 'Nenhum termo restrito encontrado.' : `Termos encontrados: ${foundForbidden.join(', ')}.`,
      weight: 0.35,
    });

    if (params.requireCta) {
      const hasCta = /(compre|assine|conheça|saiba mais|clique|baixe|experimente|garanta)/i.test(text);
      checks.push({
        label: 'Presença de CTA',
        ok: hasCta,
        detail: hasCta ? 'Chamada para ação identificada.' : 'Nenhuma chamada para ação clara encontrada.',
        weight: 0.2,
      });
    }

    const weightedScore = checks.reduce((acc, c) => acc + (c.ok ? c.weight : 0), 0) / checks.reduce((acc, c) => acc + c.weight, 0);
    return this.finalize(checks, weightedScore, true);
  }

  private finalize(checks: GateCheck[], normalizedScore: number, measured = true): GateResult {
    const score = Math.round(normalizedScore * 100 * 100) / 100;
    return { score, passed: score >= GATE_PASS_THRESHOLD, measured, checks };
  }
}
