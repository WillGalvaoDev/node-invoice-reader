import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { prisma, disconnectPrisma } from '../../src/infra/prisma.js';

const PERIOD_KIND_DAY = 'day';

function seedLedger(scope: 'global' | 'user', scopeId: string, period: string, overrides: Partial<{
  reservedRequests: number; spentRequests: number; spentTokens: number; spentCostUsdNanos: number;
}> = {}) {
  return prisma.aiUsageLedger.create({
    data: {
      scope, scopeId, periodKind: PERIOD_KIND_DAY, period,
      reservedRequests: 0, spentRequests: 0, spentTokens: 0, spentCostUsdNanos: 0,
      ...overrides,
    },
  });
}

function seedEvent(createdAt: Date, overrides: Partial<{
  operation: string; status: string; attempts: number; totalTokens: number | null; estimatedCostUsdNanos: number | null; userId: string;
}> = {}) {
  return prisma.aiCallEvent.create({
    data: {
      correlationId: crypto.randomUUID(), operation: 'invoice_extraction', model: 'gemini-2.5-flash',
      status: 'success', durationMs: 10, attempts: 1, createdAt,
      ...overrides,
    },
  });
}

function run(period?: string): { stdout: string; status: number } {
  const args = period ? ['scripts/reconcile-ai-usage.mjs', period] : ['scripts/reconcile-ai-usage.mjs'];
  try {
    const stdout = execFileSync('node', args, { env: process.env, encoding: 'utf-8' });
    return { stdout, status: 0 };
  } catch (error) {
    const execError = error as { stdout?: string; status?: number };
    return { stdout: execError.stdout ?? '', status: execError.status ?? 1 };
  }
}

async function snapshotAll() {
  return {
    ledger: await prisma.aiUsageLedger.findMany({ orderBy: [{ scope: 'asc' }, { scopeId: 'asc' }] }),
    events: await prisma.aiCallEvent.findMany({ orderBy: { id: 'asc' } }),
  };
}

beforeEach(async () => {
  await prisma.aiUsageLedger.deleteMany();
  await prisma.aiCallEvent.deleteMany();
});
afterAll(disconnectPrisma);

describe('PostgreSQL Integration Gate — reconciliação ai_usage_ledger × ai_call_events (P3-04)', () => {
  const period = '2026-01-15';
  const dayStart = new Date(`${period}T10:00:00.000Z`);

  it('caso reconciliado: requests, tokens e custo batem exatamente — sem anomalia', async () => {
    await seedLedger('global', 'global', period, { spentRequests: 2, spentTokens: 300, spentCostUsdNanos: 5_000 });
    await seedEvent(dayStart, { attempts: 1, totalTokens: 150, estimatedCostUsdNanos: 2_500 });
    await seedEvent(dayStart, { attempts: 1, totalTokens: 150, estimatedCostUsdNanos: 2_500 });

    const { stdout, status } = run(period);
    expect(status).toBe(0);
    expect(stdout).toContain('requests: reconciliado.');
    expect(stdout).toContain('tokens: reconciliado.');
    expect(stdout).toContain('Nenhuma anomalia');
  });

  it('requests divergentes além da tolerância (eventos > ledger) — ANOMALIA, não confundida com o caso benigno', async () => {
    await seedLedger('global', 'global', period, { spentRequests: 10 });
    for (let i = 0; i < 4; i++) await seedEvent(dayStart, { attempts: 4 }); // soma de attempts = 16, diff = +6, tolerância = 1

    const { stdout, status } = run(period);
    expect(status).toBe(1);
    expect(stdout).toContain('ATENÇÃO: eventos > ledger além da tolerância');
  });

  it('divergência de 1 unidade (eventos > ledger) fica dentro da tolerância — não é falso positivo do caso benigno de cota', async () => {
    await seedLedger('global', 'global', period, { spentRequests: 5 });
    await seedEvent(dayStart, { attempts: 3 });
    await seedEvent(dayStart, { attempts: 3 }); // soma = 6, diff = +1, tolerância = max(1, ceil(5*0.05)) = 1

    const { stdout, status } = run(period);
    expect(status).toBe(0);
    expect(stdout).toContain('possivelmente tentativa recusada por cota no meio de um retry');
  });

  it('requests divergentes (eventos < ledger, perda best-effort) além da tolerância — ANOMALIA', async () => {
    await seedLedger('global', 'global', period, { spentRequests: 20 });
    await seedEvent(dayStart, { attempts: 5 }); // soma = 5, diff = -15, tolerância = 1

    const { stdout, status } = run(period);
    expect(status).toBe(1);
    expect(stdout).toContain('ATENÇÃO: eventos < ledger além da tolerância');
  });

  it('tokens divergentes além da tolerância — ANOMALIA isolada de requests', async () => {
    await seedLedger('global', 'global', period, { spentRequests: 1, spentTokens: 1_000 });
    await seedEvent(dayStart, { attempts: 1, totalTokens: 100 }); // diff tokens = -900, tolerância(1000) = 50

    const { stdout, status } = run(period);
    expect(status).toBe(1);
    expect(stdout).toContain('requests: reconciliado.');
    expect(stdout).toContain('ATENÇÃO: tokens diverge além da tolerância');
  });

  it('custo divergente além da tolerância — ANOMALIA isolada', async () => {
    await seedLedger('global', 'global', period, { spentRequests: 1, spentCostUsdNanos: 10_000 });
    await seedEvent(dayStart, { attempts: 1, estimatedCostUsdNanos: 1_000 }); // diff = -9000, tolerância = 500

    const { stdout, status } = run(period);
    expect(status).toBe(1);
    expect(stdout).toContain('ATENÇÃO: custo estimado (nanoUSD) diverge além da tolerância');
  });

  it('evento sem usageMetadata (falha, tokens/custo nulos) não distorce a reconciliação de tokens/custo', async () => {
    await seedLedger('global', 'global', period, { spentRequests: 2, spentTokens: 200, spentCostUsdNanos: 3_000 });
    await seedEvent(dayStart, { status: 'success', attempts: 1, totalTokens: 200, estimatedCostUsdNanos: 3_000 });
    await seedEvent(dayStart, { status: 'failure', attempts: 1, totalTokens: null, estimatedCostUsdNanos: null }); // sem usageMetadata

    const { stdout, status } = run(period);
    expect(status).toBe(0);
    expect(stdout).toContain('requests: reconciliado.');
    expect(stdout).toContain('tokens: reconciliado.');
  });

  it('múltiplos usuários: cada escopo de usuário reconcilia só com seus próprios eventos', async () => {
    await seedLedger('user', 'user-a', period, { spentRequests: 1, spentTokens: 100 });
    await seedLedger('user', 'user-b', period, { spentRequests: 1, spentTokens: 100 });
    await seedEvent(dayStart, { attempts: 1, totalTokens: 100, userId: 'user-a' });
    await seedEvent(dayStart, { attempts: 1, totalTokens: 999, userId: 'user-b' }); // diverge só para user-b

    const { stdout, status } = run(period);
    expect(status).toBe(1);
    const userABlock = stdout.slice(stdout.indexOf('user:user-a'), stdout.indexOf('user:user-b'));
    const userBBlock = stdout.slice(stdout.indexOf('user:user-b'));
    expect(userABlock).toContain('tokens: reconciliado.');
    expect(userBBlock).toContain('ATENÇÃO: tokens diverge');
  });

  it('escopo global agrega eventos de todos os usuários, escopo de usuário não vê eventos de outro usuário', async () => {
    await seedLedger('global', 'global', period, { spentRequests: 2 });
    await seedLedger('user', 'user-x', period, { spentRequests: 1 });
    await seedEvent(dayStart, { attempts: 1, userId: 'user-x' });
    await seedEvent(dayStart, { attempts: 1, userId: 'user-y' }); // não pertence a user-x, mas conta no global

    const { stdout, status } = run(period);
    expect(status).toBe(0);
    expect(stdout).toContain('global:global');
    expect(stdout).toContain('user:user-x');
    expect(stdout).not.toContain('user:user-y'); // sem ledger para user-y, nada a reconciliar por ele
  });

  it('rollover de período: evento de outro dia não entra na reconciliação do dia alvo', async () => {
    await seedLedger('global', 'global', period, { spentRequests: 1 });
    await seedEvent(dayStart, { attempts: 1 }); // dentro do período
    await seedEvent(new Date('2026-01-16T00:00:01.000Z'), { attempts: 99 }); // dia seguinte, nunca deve contar aqui

    const { stdout, status } = run(period);
    expect(status).toBe(0);
    expect(stdout).toContain('requests: reconciliado.'); // se o evento do dia seguinte entrasse, divergiria em +99
  });

  it('zero eventos e zero ledger: nenhuma atividade, sem erro, sem anomalia', async () => {
    const { stdout, status } = run('2020-01-01');
    expect(status).toBe(0);
    expect(stdout).toContain('Nenhuma atividade em ai_usage_ledger');
  });

  it('reserva residual (reservedRequests != 0) é sempre anomalia, independentemente de requests/tokens baterem', async () => {
    await seedLedger('global', 'global', period, { reservedRequests: 1, spentRequests: 5, spentTokens: 100 });
    await seedEvent(dayStart, { attempts: 5, totalTokens: 100 }); // requests e tokens batem exatamente

    const { stdout, status } = run(period);
    expect(status).toBe(1);
    expect(stdout).toContain('ANOMALIA: reservedRequests=1 residual');
  });

  it('é somente leitura: nenhuma linha de ai_usage_ledger ou ai_call_events muda após rodar', async () => {
    await seedLedger('global', 'global', period, { spentRequests: 3, spentTokens: 300 });
    await seedEvent(dayStart, { attempts: 4, totalTokens: 10 }); // divergência deliberada, para garantir que "detectar" != "corrigir"

    const before = await snapshotAll();
    run(period);
    const after = await snapshotAll();

    expect(after).toEqual(before);
  });

  it('sem argumento, reconcilia ontem (UTC) por padrão — uso documentado no runbook', async () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const yesterdayPeriod = yesterday.toISOString().slice(0, 10);
    await seedLedger('global', 'global', yesterdayPeriod, { spentRequests: 1 });
    await seedEvent(new Date(`${yesterdayPeriod}T12:00:00.000Z`), { attempts: 1 });

    const { stdout, status } = run(); // sem argumento
    expect(status).toBe(0);
    expect(stdout).toContain(yesterdayPeriod);
    expect(stdout).toContain('requests: reconciliado.');
  });
});
