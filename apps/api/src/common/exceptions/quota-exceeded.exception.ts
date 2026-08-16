import { HttpException, HttpStatus } from '@nestjs/common';
import { QuotaConsumeResult } from '../../usage/usage.service';

/**
 * Lançada por `AiOrchestratorService.submit()` ANTES de qualquer chamada a
 * Kling/MiniMax quando `UsageService.consume()` retorna `allowed: false`.
 * 402 Payment Required é semanticamente exato aqui (o tenant precisa pagar
 * — upgrade de plano ou crédito avulso — pra continuar) e já é o código
 * usado no resto da stack (ver require-user-quota.ts no apps/web) — manter
 * consistência ajuda o frontend a tratar os dois casos com o mesmo código.
 *
 * Propositalmente uma classe distinta (não um Error genérico): permite que
 * `DirectorService.advanceProduction` distinga "sem cota" (deve propagar
 * como 402 e NÃO marcar DISPATCH_FAILED genérico) de qualquer outra falha
 * de infraestrutura.
 */
export class QuotaExceededException extends HttpException {
  constructor(public readonly quota: QuotaConsumeResult) {
    super(
      {
        error: `Cota de geração de IA esgotada (plano ${quota.plan}, ${quota.used}/${quota.limit}) e sem créditos avulsos disponíveis.`,
        quota,
      },
      HttpStatus.PAYMENT_REQUIRED,
    );
  }
}
