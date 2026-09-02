import { type AiCallTelemetryEvent, type AiSuggestionTelemetryEvent, type IAiTelemetry } from './ai-telemetry.js';
/**
 * Observabilidade real de chamadas de IA (P3-01): persiste em `ai_call_events` além do
 * log estruturado (canal secundário de debug, delegado ao telemetry de log). Escrita
 * best-effort — quem chama envolve `recordCall`/`recordSuggestion` com
 * `recordAiTelemetryBestEffort`, então uma falha aqui nunca reverte a nota.
 *
 * `recordSuggestion` permanece log-only: persistir decisões de sugestão é escopo de
 * P3-02, não desta tarefa — nenhuma tabela nova é antecipada aqui.
 */
export declare class PrismaAiTelemetry implements IAiTelemetry {
    private readonly logTelemetry;
    constructor(logTelemetry?: IAiTelemetry);
    recordCall(event: AiCallTelemetryEvent): Promise<void>;
    recordSuggestion(event: AiSuggestionTelemetryEvent): void;
}
//# sourceMappingURL=prisma-ai-telemetry.d.ts.map