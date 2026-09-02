import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AiBudgetGuard, noopAiBudgetGuard } from './ai-budget-guard.js';
import { GeminiDisabledError } from '../errors/gemini-disabled.error.js';
import { GeminiQuotaExceededError } from '../errors/gemini-quota-exceeded.error.js';
import { AppError } from '../errors/app-error.js';
vi.mock('../config/env.js', () => ({
    env: { GEMINI_ENABLED: true, GEMINI_GLOBAL_REQUESTS_PER_DAY: 18, GEMINI_USER_REQUESTS_PER_DAY: 5 },
}));
const { env } = await import('../config/env.js');
describe('AiBudgetGuard', () => {
    const ledger = { reserveRequest: vi.fn(), reconcileRequest: vi.fn() };
    const applicationLogger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const now = () => new Date('2026-09-03T12:00:00.000Z');
    beforeEach(() => {
        vi.clearAllMocks();
        env.GEMINI_ENABLED = true;
        ledger.reserveRequest.mockResolvedValue({});
        ledger.reconcileRequest.mockResolvedValue(undefined);
    });
    describe('assertEnabled', () => {
        it('não lança quando habilitado e o modelo tem preço', () => {
            const guard = new AiBudgetGuard(ledger, 'gemini-2.5-flash', now, applicationLogger);
            expect(() => guard.assertEnabled()).not.toThrow();
        });
        it('lança GeminiDisabledError (503, sem retryAfterSeconds) quando GEMINI_ENABLED=false — estado B', () => {
            env.GEMINI_ENABLED = false;
            const guard = new AiBudgetGuard(ledger, 'gemini-2.5-flash', now, applicationLogger);
            expect(() => guard.assertEnabled()).toThrow(GeminiDisabledError);
            try {
                guard.assertEnabled();
            }
            catch (error) {
                expect(error).toBeInstanceOf(AppError);
                expect(error.statusCode).toBe(503);
            }
            expect(applicationLogger.warn).toHaveBeenCalledWith('AI call refused: disabled by operator', expect.objectContaining({ state: 'B' }));
        });
        it('recusa (503) modelo sem entrada em MODEL_PRICING — fail-closed, não permitido', () => {
            const guard = new AiBudgetGuard(ledger, 'modelo-sem-preco-inventado', now, applicationLogger);
            expect(() => guard.assertEnabled()).toThrow(AppError);
            try {
                guard.assertEnabled();
            }
            catch (error) {
                expect(error.statusCode).toBe(503);
            }
        });
    });
    describe('reserveAttempt', () => {
        it('aceita quando o ledger não recusa nenhum escopo', async () => {
            const guard = new AiBudgetGuard(ledger, 'gemini-2.5-flash', now, applicationLogger);
            await expect(guard.reserveAttempt('user-1')).resolves.toBeUndefined();
            expect(ledger.reserveRequest).toHaveBeenCalledWith('user-1', now());
        });
        it('lança GeminiQuotaExceededError(global, 503) com Retry-After até a virada do dia', async () => {
            ledger.reserveRequest.mockResolvedValueOnce({ rejectedScope: 'global' });
            const guard = new AiBudgetGuard(ledger, 'gemini-2.5-flash', now, applicationLogger);
            const error = await guard.reserveAttempt('user-1').catch((caught) => caught);
            expect(error).toBeInstanceOf(GeminiQuotaExceededError);
            expect(error.statusCode).toBe(503);
            expect(error.scope).toBe('global');
            expect(error.retryAfterSeconds).toBe(12 * 60 * 60); // meio-dia UTC -> meia-noite = 12h
        });
        it('lança GeminiQuotaExceededError(user, 429) quando só o escopo do usuário excede', async () => {
            ledger.reserveRequest.mockResolvedValueOnce({ rejectedScope: 'user' });
            const guard = new AiBudgetGuard(ledger, 'gemini-2.5-flash', now, applicationLogger);
            const error = await guard.reserveAttempt('user-1').catch((caught) => caught);
            expect(error).toBeInstanceOf(GeminiQuotaExceededError);
            expect(error.statusCode).toBe(429);
            expect(error.scope).toBe('user');
        });
        it('fail-closed: falha do ledger vira 503, nunca propaga o erro cru nem permite a chamada', async () => {
            ledger.reserveRequest.mockRejectedValueOnce(new Error('connection lost'));
            const guard = new AiBudgetGuard(ledger, 'gemini-2.5-flash', now, applicationLogger);
            const error = await guard.reserveAttempt('user-1').catch((caught) => caught);
            expect(error).toBeInstanceOf(AppError);
            expect(error.statusCode).toBe(503);
            expect(JSON.stringify(error.message)).not.toContain('connection lost');
        });
        it('loga toda recusa com escopo e motivo, sem segredo', async () => {
            ledger.reserveRequest.mockResolvedValueOnce({ rejectedScope: 'user' });
            const guard = new AiBudgetGuard(ledger, 'gemini-2.5-flash', now, applicationLogger);
            await guard.reserveAttempt('user-1').catch(() => { });
            expect(applicationLogger.warn).toHaveBeenCalledWith('AI call refused: internal daily quota reached', expect.objectContaining({
                state: 'C', scope: 'user',
            }));
        });
    });
    describe('reconcileAttempt', () => {
        it('delega ao ledger com o consumo informado', async () => {
            const guard = new AiBudgetGuard(ledger, 'gemini-2.5-flash', now, applicationLogger);
            await guard.reconcileAttempt('user-1', { tokens: 120, costUsdNanos: 5_000 });
            expect(ledger.reconcileRequest).toHaveBeenCalledWith('user-1', now(), { tokens: 120, costUsdNanos: 5_000 });
        });
        it('best-effort: falha do ledger na reconciliação não propaga (a chamada ao Gemini já aconteceu)', async () => {
            ledger.reconcileRequest.mockRejectedValueOnce(new Error('write failed'));
            const guard = new AiBudgetGuard(ledger, 'gemini-2.5-flash', now, applicationLogger);
            await expect(guard.reconcileAttempt('user-1', {})).resolves.toBeUndefined();
            expect(applicationLogger.error).toHaveBeenCalledWith('AI usage ledger reconciliation failed', expect.objectContaining({
                error: { name: 'Error' },
            }));
        });
    });
});
describe('noopAiBudgetGuard', () => {
    it('nunca recusa e nunca toca em nada — default seguro para quem não configura orçamento', async () => {
        expect(() => noopAiBudgetGuard.assertEnabled()).not.toThrow();
        await expect(noopAiBudgetGuard.reserveAttempt('any-user')).resolves.toBeUndefined();
        await expect(noopAiBudgetGuard.reconcileAttempt('any-user', {})).resolves.toBeUndefined();
    });
});
//# sourceMappingURL=ai-budget-guard.spec.js.map