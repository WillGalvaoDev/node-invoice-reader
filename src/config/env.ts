import 'dotenv/config';

type Environment = NodeJS.ProcessEnv | Record<string, string | undefined>;

function required(environment: Environment, name: string): string {
  const value = environment[name]?.trim();
  if (!value) {
    throw new Error(`Variável de ambiente obrigatória ausente: ${name}`);
  }
  return value;
}

function parsePort(value: string | undefined): number {
  if (value === undefined || value.trim() === '') return 3333;

  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('Variável de ambiente inválida: PORT');
  }
  return port;
}

function parseIntegerInRange(
  value: string | undefined,
  defaultValue: number,
  name: string,
  minimum: number,
  maximum: number,
): number {
  if (value === undefined || value.trim() === '') return defaultValue;

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`Variável de ambiente inválida: ${name}`);
  }
  return parsed;
}

function parseDecimalInRange(
  value: string | undefined,
  defaultValue: number,
  name: string,
  minimum: number,
  maximum: number,
): number {
  if (value === undefined || value.trim() === '') return defaultValue;

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`Variável de ambiente inválida: ${name}`);
  }
  return parsed;
}

function parseCorsAllowedOrigins(value: string | undefined): string[] {
  if (value === undefined || value.trim() === '') return [];

  return [...new Set(value.split(',').map((entry) => entry.trim()).filter(Boolean).map((entry) => {
    if (entry === '*') throw new Error('Variável de ambiente inválida: CORS_ALLOWED_ORIGINS');

    let parsed: URL;
    try {
      parsed = new URL(entry);
    } catch {
      throw new Error('Variável de ambiente inválida: CORS_ALLOWED_ORIGINS');
    }

    const isHttpOrigin = parsed.protocol === 'http:' || parsed.protocol === 'https:';
    const hasOnlyOrigin = parsed.pathname === '/' && !parsed.search && !parsed.hash;
    if (!isHttpOrigin || !hasOnlyOrigin || parsed.username || parsed.password || parsed.origin === 'null') {
      throw new Error('Variável de ambiente inválida: CORS_ALLOWED_ORIGINS');
    }

    return parsed.origin;
  }))];
}

export function createEnv(environment: Environment) {
  return {
    DATABASE_URL: required(environment, 'DATABASE_URL'),
    JWT_SECRET: required(environment, 'JWT_SECRET'),
    GEMINI_API_KEY: required(environment, 'GEMINI_API_KEY'),
    PORT: parsePort(environment.PORT),
    GEMINI_TIMEOUT_MS: parseIntegerInRange(environment.GEMINI_TIMEOUT_MS, 30_000, 'GEMINI_TIMEOUT_MS', 1_000, 30_000),
    GEMINI_MAX_ATTEMPTS: parseIntegerInRange(environment.GEMINI_MAX_ATTEMPTS, 2, 'GEMINI_MAX_ATTEMPTS', 1, 2),
    TRUST_PROXY_HOPS: parseIntegerInRange(environment.TRUST_PROXY_HOPS, 0, 'TRUST_PROXY_HOPS', 0, 10),
    CORS_ALLOWED_ORIGINS: parseCorsAllowedOrigins(environment.CORS_ALLOWED_ORIGINS),
    REQUEST_TIMEOUT_MS: parseIntegerInRange(environment.REQUEST_TIMEOUT_MS, 120_000, 'REQUEST_TIMEOUT_MS', 30_000, 300_000),
    SHUTDOWN_TIMEOUT_MS: parseIntegerInRange(environment.SHUTDOWN_TIMEOUT_MS, 30_000, 'SHUTDOWN_TIMEOUT_MS', 1_000, 120_000),
    // Fonte única do limiar de similaridade: mesmo valor usado no prompt e na decisão em código (M6-02).
    SIMILARITY_CONFIDENCE_THRESHOLD: parseDecimalInRange(environment.SIMILARITY_CONFIDENCE_THRESHOLD, 0.7, 'SIMILARITY_CONFIDENCE_THRESHOLD', 0, 1),
  };
}

export const env = createEnv(process.env);
