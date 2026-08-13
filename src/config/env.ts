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

export function createEnv(environment: Environment) {
  return {
    DATABASE_URL: required(environment, 'DATABASE_URL'),
    JWT_SECRET: required(environment, 'JWT_SECRET'),
    GEMINI_API_KEY: required(environment, 'GEMINI_API_KEY'),
    PORT: parsePort(environment.PORT),
    GEMINI_TIMEOUT_MS: parseIntegerInRange(environment.GEMINI_TIMEOUT_MS, 30_000, 'GEMINI_TIMEOUT_MS', 1_000, 30_000),
    GEMINI_MAX_ATTEMPTS: parseIntegerInRange(environment.GEMINI_MAX_ATTEMPTS, 2, 'GEMINI_MAX_ATTEMPTS', 1, 2),
  };
}

export const env = createEnv(process.env);
