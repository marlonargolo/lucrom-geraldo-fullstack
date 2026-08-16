import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { IsIn, IsInt, IsPositive, IsString, IsUUID } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiTokenGuard } from '../common/guards/api-token.guard';
import { JwtPayload } from '../auth/auth.service';
import { BillingService } from './billing.service';
import type { PaymentMethod, PaymentStatus } from './payment.entity';
import { ONE_OFF_PRODUCTS, type OneOffProductCode } from './one-off-products';

class CreateCheckoutIntentDto {
  @IsIn(['PRO'])
  plan: 'PRO';

  @IsIn(['pix', 'card'])
  method: PaymentMethod;

  @IsInt()
  @IsPositive()
  amountCents: number;
}

class CreateOneOffCheckoutIntentDto {
  // BLINDAGEM: só o código do produto vem do cliente. Preço e créditos são
  // resolvidos no servidor a partir de ONE_OFF_PRODUCTS — qualquer
  // `amountCents` que o cliente tentasse mandar aqui seria ignorado, então
  // nem expomos o campo no DTO.
  @IsIn(['AVULSO', 'PACOTE5'])
  productCode: OneOffProductCode;

  @IsIn(['pix', 'card'])
  method: PaymentMethod;
}

class ConfirmPaymentDto {
  @IsUUID()
  paymentId: string;

  @IsString()
  externalId: string;

  @IsIn(['approved', 'rejected', 'refunded'])
  status: PaymentStatus;
}

class AttachExternalIdDto {
  @IsString()
  externalId: string;
}

/**
 * Billing & Checkout.
 *
 * `checkout-intents*` — usuário final, autenticado via JWT (mesmo padrão de
 * UsageController). `webhook/*` — SÓ chamado pela Route Handler
 * app/api/billing/webhook/route.ts (apps/web) depois de já ter verificado a
 * assinatura do Mercado Pago; protegido por ApiTokenGuard (server-to-server,
 * não há JWT de usuário no contexto de um webhook de gateway de pagamento).
 */
@Controller('api/v1/billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @UseGuards(JwtAuthGuard)
  @Post('checkout-intents')
  createIntent(@Req() req: Request & { user: JwtPayload }, @Body() dto: CreateCheckoutIntentDto) {
    return this.billing.createPendingPayment({
      tenantId: req.user.tenantId,
      plan: dto.plan,
      amountCents: dto.amountCents,
      method: dto.method,
    });
  }

  /**
   * Compra avulsa (AVULSO — 1 vídeo, R$ 39,90) ou pacote fechado (PACOTE5 —
   * 5 vídeos de 60s, R$ 179,90). Endpoint separado de `checkout-intents`
   * de propósito: aqui o cliente NUNCA informa preço, só o `productCode` —
   * o valor cobrado vem sempre de ONE_OFF_PRODUCTS (billing/one-off-products.ts),
   * nunca do corpo da requisição.
   */
  @UseGuards(JwtAuthGuard)
  @Post('checkout-intents/one-off')
  createOneOffIntent(@Req() req: Request & { user: JwtPayload }, @Body() dto: CreateOneOffCheckoutIntentDto) {
    return this.billing.createPendingOneOffPayment({
      tenantId: req.user.tenantId,
      productCode: dto.productCode,
      method: dto.method,
    });
  }

  /** Preços/créditos públicos dos produtos avulsos — a UI consulta aqui em vez de hardcodar valores que podem sair de sincronia com o backend. */
  @Get('products/one-off')
  listOneOffProducts() {
    return Object.values(ONE_OFF_PRODUCTS);
  }

  @UseGuards(JwtAuthGuard)
  @Get('checkout-intents/:id')
  getIntent(@Param('id') id: string) {
    return this.billing.getPayment(id);
  }

  @UseGuards(ApiTokenGuard)
  @Post('checkout-intents/:id/external-id')
  attachExternalId(@Param('id') id: string, @Body() dto: AttachExternalIdDto) {
    return this.billing.attachExternalId(id, dto.externalId);
  }

  @UseGuards(ApiTokenGuard)
  @Post('webhook/confirm')
  confirmPayment(@Body() dto: ConfirmPaymentDto) {
    return this.billing.confirmPayment(dto.paymentId, dto.externalId, dto.status);
  }
}
