import { Injectable } from '@nestjs/common';
import { FrameStats, computeColorCorrection, computeColorCorrectionAbsolute } from '../audit/fidelity.service';
import { GatesService } from '../audit/gates.service';
import { AxisResult, DiagnosisReport, QUALITY_PASS_THRESHOLD } from './quality-director.types';

export interface AudioLoudness {
  integratedLoudnessLufs: number;
  truePeakDb: number;
  loudnessRangeLu: number;
}

export interface DenoiseStrength {
  lumaSpatial: number;
  chromaSpatial: number;
  lumaTmp: number;
  chromaTmp: number;
}

/**
 * Implementa o "Módulo AI Quality Director" do documento de diretrizes:
 * avalia eixos técnicos objetivos, atribui nota e justificativa, e decide
 * os parâmetros de correção — para o loop Diagnóstico → Correção → Diagnóstico
 * (Camada 1 do pipeline) rodar até atingir o padrão ou esgotar as iterações.
 */
@Injectable()
export class QualityDirectorService {
  constructor(private readonly gates: GatesService) {}

  diagnose(params: {
    frame: FrameStats;
    reference: FrameStats | null;
    audio: AudioLoudness | null;
    stabilizationJitter: number | null; // 0..1, quanto menor melhor
    brandKit?: { palette: string[]; forbiddenWords?: string[] } | null;
    scriptText?: string | null;
  }): DiagnosisReport {
    const axes: AxisResult[] = [];

    // ---- Exposição/Iluminação ----
    const clipTotal = params.frame.clippingShadows + params.frame.clippingHighlights;
    axes.push({
      axis: 'EXPOSICAO_ILUMINACAO',
      implemented: true,
      score: Math.max(0, Math.round((1 - Math.min(1, clipTotal * 8)) * 100)),
      ok: clipTotal < 0.03,
      justification: `Sombras estouradas: ${(params.frame.clippingShadows * 100).toFixed(1)}% · Altas-luzes estouradas: ${(params.frame.clippingHighlights * 100).toFixed(1)}% (ideal: soma < 3%).`,
      weight: 0.2,
    });

    // ---- Nitidez ----
    // Limiar empírico (variância do Laplaciano); abaixo disso a imagem tende a parecer desfocada.
    const sharpnessOk = params.frame.sharpness > 15;
    axes.push({
      axis: 'NITIDEZ',
      implemented: true,
      score: Math.max(0, Math.min(100, Math.round((params.frame.sharpness / 40) * 100))),
      ok: sharpnessOk,
      justification: `Variância do Laplaciano: ${params.frame.sharpness.toFixed(1)} (ideal: > 15; quanto maior, mais nítido).`,
      weight: 0.15,
    });

    // ---- Ruído ----
    axes.push({
      axis: 'RUIDO',
      implemented: true,
      score: Math.round((1 - params.frame.noise) * 100),
      ok: params.frame.noise < 0.25,
      justification: `Nível de ruído normalizado: ${(params.frame.noise * 100).toFixed(1)}% (ideal: < 25%).`,
      weight: 0.15,
    });

    // ---- Estabilização ----
    if (params.stabilizationJitter !== null) {
      axes.push({
        axis: 'ESTABILIZACAO',
        implemented: true,
        score: Math.round((1 - Math.min(1, params.stabilizationJitter)) * 100),
        ok: params.stabilizationJitter < 0.15,
        justification: `Jitter médio entre frames amostrados: ${(params.stabilizationJitter * 100).toFixed(1)}% (ideal: < 15%).`,
        weight: 0.15,
      });
    }

    // ---- Áudio ----
    if (params.audio) {
      const inRange = params.audio.integratedLoudnessLufs >= -20 && params.audio.integratedLoudnessLufs <= -12;
      const noClipping = params.audio.truePeakDb <= -1;
      axes.push({
        axis: 'AUDIO',
        implemented: true,
        score: Math.round(((inRange ? 0.6 : 0) + (noClipping ? 0.4 : 0)) * 100),
        ok: inRange && noClipping,
        justification: `Loudness integrado: ${params.audio.integratedLoudnessLufs.toFixed(1)} LUFS (ideal: -20 a -12) · Pico real: ${params.audio.truePeakDb.toFixed(1)} dB (ideal: ≤ -1 dB, sem clipping).`,
        weight: 0.2,
      });
    } else {
      axes.push({
        axis: 'AUDIO',
        implemented: true,
        score: null,
        ok: null,
        justification: 'Sem faixa de áudio detectável no arquivo enviado.',
        weight: 0,
      });
    }

    // ---- Compliance de Marca (reaproveita o Gate 1 já existente) ----
    if (params.brandKit) {
      const brandGate = this.gates.evaluateBrandGate({
        renderedPalette: params.frame.palette,
        brandPalette: params.brandKit.palette,
        scriptText: params.scriptText ?? '',
        forbiddenWords: params.brandKit.forbiddenWords,
      });
      axes.push({
        axis: 'COMPLIANCE_MARCA',
        implemented: true,
        score: brandGate.score,
        ok: brandGate.passed,
        justification: brandGate.checks.map((c) => `${c.ok ? '✓' : '✗'} ${c.label}: ${c.detail}`).join(' | '),
        weight: 0.1,
      });
    }

    // ---- Tom/Roteiro (reaproveita o Gate 3 já existente) ----
    if (params.scriptText) {
      const toneGate = this.gates.evaluateToneGate({ scriptText: params.scriptText, forbiddenWords: params.brandKit?.forbiddenWords });
      axes.push({
        axis: 'TOM_ROTEIRO',
        implemented: true,
        score: toneGate.score,
        ok: toneGate.passed,
        justification: toneGate.checks.map((c) => `${c.ok ? '✓' : '✗'} ${c.label}: ${c.detail}`).join(' | '),
        weight: 0.05,
      });
    }

    // ---- Eixos explicitamente NÃO implementados nesta versão (produção criativa/generativa) ----
    const notImplemented: { axis: AxisResult['axis']; why: string }[] = [
      { axis: 'TIPOGRAFIA', why: 'Exige geração/composição de legendas e textos na peça — camada criativa, fora deste motor.' },
      { axis: 'BRANDING_VISUAL', why: 'Exige composição de overlays de marca (logo, grafismos) — camada criativa, fora deste motor.' },
      { axis: 'NARRATIVA', why: 'Exige IA de compreensão de roteiro/ritmo narrativo além de heurística de texto — não implementado.' },
      { axis: 'MOTION', why: 'Exige motion design (animações, transições) — camada criativa, fora deste motor.' },
      { axis: 'RETENCAO', why: 'Exige dados reais de audiência (analytics pós-publicação) — não disponível nesta etapa do pipeline.' },
    ];
    for (const n of notImplemented) {
      axes.push({ axis: n.axis, implemented: false, score: null, ok: null, justification: n.why, weight: 0 });
    }

    const scored = axes.filter((a) => a.implemented && a.score !== null && a.weight > 0);
    const totalWeight = scored.reduce((acc, a) => acc + a.weight, 0) || 1;
    const overallScore = Math.round((scored.reduce((acc, a) => acc + a.score! * a.weight, 0) / totalWeight) * 100) / 100;

    return { overallScore, passed: overallScore >= QUALITY_PASS_THRESHOLD, axes };
  }

  /** Decide os parâmetros de correção de cor — com ou sem referência (padrão absoluto). */
  decideColorCorrection(frame: FrameStats, reference: FrameStats | null) {
    return reference ? computeColorCorrection(frame, reference) : computeColorCorrectionAbsolute(frame);
  }

  /**
   * Decide a força do denoise proporcionalmente ao ruído medido — quanto mais
   * ruído, mais forte o filtro hqdn3d, até um teto que evita "derreter" detalhe.
   */
  decideDenoiseStrength(noise: number): DenoiseStrength | null {
    if (noise < 0.08) return null; // ruído já baixo, denoise desnecessário (evita perda de nitidez)
    const intensity = Math.min(1, noise); // 0..1
    return {
      lumaSpatial: 2 + intensity * 4, // 2..6
      chromaSpatial: 1.5 + intensity * 3.5, // 1.5..5
      lumaTmp: 3 + intensity * 6, // 3..9
      chromaTmp: 2 + intensity * 5, // 2..7
    };
  }
}
