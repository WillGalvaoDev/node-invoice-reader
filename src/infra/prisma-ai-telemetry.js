import { prisma } from './prisma.js';
import { aiTelemetry } from './ai-telemetry.js';
/**
 * Observabilidade real de chamadas de IA (P3-01): persiste em `ai_call_events` além do
 * log estruturado (canal secundário de debug, delegado ao telemetry de log). Escrita
 * best-effort — quem chama envolve `recordCall`/`recordSuggestion` com
 * `recordAiTelemetryBestEffort`, então uma falha aqui nunca reverte a nota.
 *
 * `recordSuggestion` permanece log-only: persistir decisões de sugestão é escopo de
 * P3-02, não desta tarefa — nenhuma tabela nova é antecipada aqui.
 */
export class PrismaAiTelemetry {
    logTelemetry;
    constructor(logTelemetry = aiTelemetry) {
        this.logTelemetry = logTelemetry;
    }
    async recordCall(event) {
        await this.logTelemetry.recordCall(event);
        // Recusar, não mascarar (mesmo princípio de P3-00B): sem correlationId não há o que
        // persistir com sentido — nunca gravar um placeholder silencioso na coluna obrigatória.
        if (!event.correlationId) {
            throw new Error('AiCallTelemetryEvent sem correlationId: recusado antes da escrita em ai_call_events.');
        }
        await prisma.aiCallEvent.create({
            data: {
                correlationId: event.correlationId,
                operation: event.operation,
                model: event.model,
                status: event.status,
                durationMs: event.durationMs,
                attempts: event.attempts,
                ...(event.requestId !== undefined && { requestId: event.requestId }),
                ...(event.modelVersion !== undefined && { modelVersion: event.modelVersion }),
                ...(event.inputTokens !== undefined && { inputTokens: event.inputTokens }),
                ...(event.outputTokens !== undefined && { outputTokens: event.outputTokens }),
                ...(event.totalTokens !== undefined && { totalTokens: event.totalTokens }),
                ...(event.estimatedCostUsdNanos !== undefined && { estimatedCostUsdNanos: event.estimatedCostUsdNanos }),
                ...(event.failureCategory !== undefined && { failureCategory: event.failureCategory }),
                ...(event.userId !== undefined && { userId: event.userId }),
                ...(event.companyId !== undefined && { companyId: event.companyId }),
                ...(event.stockId !== undefined && { stockId: event.stockId }),
            },
        });
    }
    recordSuggestion(event) {
        this.logTelemetry.recordSuggestion(event);
    }
}
//# sourceMappingURL=prisma-ai-telemetry.js.map