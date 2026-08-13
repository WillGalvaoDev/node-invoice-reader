export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export interface LogEntry {
    level: LogLevel;
    message: string;
    timestamp: string;
    requestId?: string;
    context?: Record<string, unknown>;
}
export interface Logger {
    debug(message: string, context?: Record<string, unknown>): void;
    info(message: string, context?: Record<string, unknown>): void;
    warn(message: string, context?: Record<string, unknown>): void;
    error(message: string, context?: Record<string, unknown>): void;
}
interface CreateLoggerOptions {
    level?: LogLevel;
    sink?: (entry: LogEntry) => void;
    now?: () => Date;
}
export declare function createLogger({ level, sink, now }?: CreateLoggerOptions): Logger;
export declare const logger: Logger;
export {};
//# sourceMappingURL=logger.d.ts.map