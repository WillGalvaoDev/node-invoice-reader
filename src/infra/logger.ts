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

const REDACTED = '[REDACTED]';
const SENSITIVE_KEYS = new Set([
  'password',
  'passwordhash',
  'authorization',
  'cookie',
  'setcookie',
  'token',
  'accesstoken',
  'refreshtoken',
  'jwt',
  'apikey',
  'geminiapikey',
  'secret',
  'jwtsecret',
  'invitecode',
]);
const LEVEL_PRIORITY: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function normalizeKey(key: string): string {
  return key.replace(/[^a-z0-9]/gi, '').toLowerCase();
}

function redact(value: unknown, seen = new WeakSet<object>()): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (value instanceof Date) return value.toISOString();
  if (seen.has(value)) return '[Circular]';
  seen.add(value);

  if (Array.isArray(value)) return value.map((item) => redact(item, seen));

  const result: Record<string, unknown> = {};
  for (const [key, nestedValue] of Object.entries(value)) {
    result[key] = SENSITIVE_KEYS.has(normalizeKey(key)) ? REDACTED : redact(nestedValue, seen);
  }
  return result;
}

function defaultSink(entry: LogEntry): void {
  const serialized = `${JSON.stringify(entry)}\n`;
  if (entry.level === 'warn' || entry.level === 'error') process.stderr.write(serialized);
  else process.stdout.write(serialized);
}

export function createLogger({ level = 'info', sink = defaultSink, now = () => new Date() }: CreateLoggerOptions = {}): Logger {
  const write = (entryLevel: LogLevel, message: string, suppliedContext?: Record<string, unknown>) => {
    if (LEVEL_PRIORITY[entryLevel] < LEVEL_PRIORITY[level]) return;

    const redactedContext = redact(suppliedContext ?? {}) as Record<string, unknown>;
    const requestId = typeof redactedContext.requestId === 'string' ? redactedContext.requestId : undefined;
    delete redactedContext.requestId;

    const entry: LogEntry = { level: entryLevel, message, timestamp: now().toISOString() };
    if (requestId) entry.requestId = requestId;
    if (Object.keys(redactedContext).length > 0) entry.context = redactedContext;
    sink(entry);
  };

  return {
    debug: (message, context) => write('debug', message, context),
    info: (message, context) => write('info', message, context),
    warn: (message, context) => write('warn', message, context),
    error: (message, context) => write('error', message, context),
  };
}

export const logger = createLogger();

