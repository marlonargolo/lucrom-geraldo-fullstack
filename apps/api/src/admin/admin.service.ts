import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

export interface AdminOverview {
  tenants: { total: number; byPlan: Record<string, number> };
  users: { total: number; activeLast30d: number };
  jobs: { total: number; done: number; failed: number; inProgress: number; successRate: number };
  revenue: { approvedCentsLast30d: number; approvedCentsTotal: number };
  providers: Array<{ provider: string; total: number; done: number; failed: number; successRate: number }>;
}

export interface AdminActivityItem {
  kind: 'tenant_created' | 'payment_approved' | 'job_done' | 'job_failed';
  label: string;
  createdAt: string;
}

export interface AdminRiskAlert {
  tenantId: string;
  tenantName: string;
  jobsLastHour: number;
  reason: string;
}

/** Taxa de sucesso só sobre jobs já finalizados (DONE + FAILED); 0 quando não há nenhum. */
function successRate(done: number, failed: number): number {
  const finished = done + failed;
  return finished === 0 ? 0 : done / finished;
}

/**
 * Métricas do painel /studio/admin (equipe da plataforma) — agregações
 * somente-leitura sobre tenants, users, ai_generation_jobs e payments.
 * Consultas agregadas direto em SQL (COUNT/SUM FILTER) pra não carregar
 * linhas na memória da aplicação.
 */
@Injectable()
export class AdminService {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  async overview(): Promise<AdminOverview> {
    const [plans, users, jobs, revenue, providers] = await Promise.all([
      this.db.query(`SELECT plan_tier, COUNT(*)::int AS count FROM tenants GROUP BY plan_tier`),
      this.db.query(`
        SELECT COUNT(*)::int AS total,
               COUNT(*) FILTER (WHERE last_login_at >= now() - interval '30 days')::int AS active
        FROM users`),
      this.db.query(`
        SELECT COUNT(*)::int AS total,
               COUNT(*) FILTER (WHERE status = 'DONE')::int AS done,
               COUNT(*) FILTER (WHERE status = 'FAILED')::int AS failed,
               COUNT(*) FILTER (WHERE status IN ('PENDING', 'PROCESSING'))::int AS in_progress
        FROM ai_generation_jobs`),
      this.db.query(`
        SELECT COALESCE(SUM(amount_cents) FILTER (WHERE created_at >= now() - interval '30 days'), 0)::bigint AS last30,
               COALESCE(SUM(amount_cents), 0)::bigint AS total
        FROM payments WHERE status = 'approved'`),
      this.db.query(`
        SELECT provider,
               COUNT(*)::int AS total,
               COUNT(*) FILTER (WHERE status = 'DONE')::int AS done,
               COUNT(*) FILTER (WHERE status = 'FAILED')::int AS failed
        FROM ai_generation_jobs GROUP BY provider ORDER BY provider`),
    ]);

    const byPlan: Record<string, number> = {};
    let tenantTotal = 0;
    for (const row of plans as Array<{ plan_tier: string | null; count: number }>) {
      byPlan[row.plan_tier ?? 'CREATOR'] = (byPlan[row.plan_tier ?? 'CREATOR'] ?? 0) + Number(row.count);
      tenantTotal += Number(row.count);
    }

    const j = jobs[0] ?? { total: 0, done: 0, failed: 0, in_progress: 0 };
    return {
      tenants: { total: tenantTotal, byPlan },
      users: { total: Number(users[0]?.total ?? 0), activeLast30d: Number(users[0]?.active ?? 0) },
      jobs: {
        total: Number(j.total),
        done: Number(j.done),
        failed: Number(j.failed),
        inProgress: Number(j.in_progress),
        successRate: successRate(Number(j.done), Number(j.failed)),
      },
      revenue: {
        approvedCentsLast30d: Number(revenue[0]?.last30 ?? 0),
        approvedCentsTotal: Number(revenue[0]?.total ?? 0),
      },
      providers: (providers as Array<{ provider: string; total: number; done: number; failed: number }>).map((p) => ({
        provider: p.provider,
        total: Number(p.total),
        done: Number(p.done),
        failed: Number(p.failed),
        successRate: successRate(Number(p.done), Number(p.failed)),
      })),
    };
  }

  /** Linha do tempo com os eventos mais recentes (novos tenants, pagamentos aprovados, jobs finalizados). */
  async activity(limit: number): Promise<AdminActivityItem[]> {
    const rows: Array<{ kind: AdminActivityItem['kind']; label: string; created_at: Date }> = await this.db.query(
      `
      SELECT * FROM (
        SELECT 'tenant_created' AS kind, 'Nova conta: ' || name AS label, created_at FROM tenants
        UNION ALL
        SELECT 'payment_approved', 'Pagamento aprovado: ' || product_type || ' · ' || t.name, p.updated_at
        FROM payments p JOIN tenants t ON t.id = p.tenant_id WHERE p.status = 'approved'
        UNION ALL
        SELECT CASE WHEN j.status = 'DONE' THEN 'job_done' ELSE 'job_failed' END,
               CASE WHEN j.status = 'DONE' THEN 'Vídeo gerado' ELSE 'Falha na geração' END || ' (' || j.provider || ') · ' || t.name,
               j.updated_at
        FROM ai_generation_jobs j JOIN tenants t ON t.id = j.tenant_id WHERE j.status IN ('DONE', 'FAILED')
      ) events
      ORDER BY created_at DESC
      LIMIT $1
      `,
      [limit],
    );
    return rows.map((r) => ({ kind: r.kind, label: r.label, createdAt: new Date(r.created_at).toISOString() }));
  }

  /** Tenants com volume anormal de gerações na última hora (possível abuso/automação). */
  async riskAlerts(thresholdPerHour: number): Promise<AdminRiskAlert[]> {
    const rows: Array<{ tenant_id: string; name: string; jobs: number }> = await this.db.query(
      `
      SELECT j.tenant_id, t.name, COUNT(*)::int AS jobs
      FROM ai_generation_jobs j JOIN tenants t ON t.id = j.tenant_id
      WHERE j.created_at >= now() - interval '1 hour'
      GROUP BY j.tenant_id, t.name
      HAVING COUNT(*) >= $1
      ORDER BY jobs DESC
      LIMIT 50
      `,
      [thresholdPerHour],
    );
    return rows.map((r) => ({
      tenantId: r.tenant_id,
      tenantName: r.name,
      jobsLastHour: Number(r.jobs),
      reason: `${r.jobs} gerações na última hora (limite de alerta: ${thresholdPerHour}/h)`,
    }));
  }
}
