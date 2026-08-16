/**
 * Eixos do "Módulo AI Quality Director" citados no documento de diretrizes.
 * Os marcados como IMPLEMENTADO são objetivos e mensuráveis com processamento
 * de sinal (o que este backend faz). Os marcados como NÃO IMPLEMENTADO exigem
 * uma camada criativa/generativa (composição, geração de gráficos, IA de
 * texto) fora do escopo desta entrega — aparecem no relatório para deixar
 * claro o que falta, nunca com nota fake.
 */
export type QualityAxis =
  | 'EXPOSICAO_ILUMINACAO' // implementado
  | 'NITIDEZ' // implementado
  | 'RUIDO' // implementado
  | 'ESTABILIZACAO' // implementado
  | 'AUDIO' // implementado
  | 'COMPLIANCE_MARCA' // implementado (reaproveita GatesService)
  | 'TOM_ROTEIRO' // implementado (reaproveita GatesService)
  | 'TIPOGRAFIA' // não implementado — produção criativa
  | 'BRANDING_VISUAL' // não implementado — composição/overlay
  | 'NARRATIVA' // não implementado — exige IA de texto/roteiro avançada
  | 'MOTION' // não implementado — motion graphics
  | 'RETENCAO'; // não implementado — exige dados de audiência real

export interface AxisResult {
  axis: QualityAxis;
  implemented: boolean;
  score: number | null; // 0..100, null se não implementado
  ok: boolean | null;
  justification: string;
  weight: number; // peso relativo entre os eixos IMPLEMENTADOS
}

export interface DiagnosisReport {
  overallScore: number; // 0..100, calculado só sobre os eixos implementados
  passed: boolean;
  axes: AxisResult[];
}

export const QUALITY_PASS_THRESHOLD = 82;
export const MAX_CORRECTION_ITERATIONS = 2; // custo de reencode limita o loop — ver README
