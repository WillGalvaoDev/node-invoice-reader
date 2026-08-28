import 'dotenv/config';
function required(environment, name) {
    const value = environment[name]?.trim();
    if (!value) {
        throw new Error(`Variável de ambiente obrigatória ausente: ${name}`);
    }
    return value;
}
const JWT_SECRET_MIN_LENGTH = 32;
function requireJwtSecret(environment) {
    const value = required(environment, 'JWT_SECRET');
    if (value.length < JWT_SECRET_MIN_LENGTH) {
        throw new Error(`Variável de ambiente inválida: JWT_SECRET deve ter no mínimo ${JWT_SECRET_MIN_LENGTH} caracteres.`);
    }
    return value;
}
const INVITE_CODE_MIN_LENGTH = 8;
function requireInviteCode(environment) {
    const value = required(environment, 'INVITE_CODE');
    if (value.length < INVITE_CODE_MIN_LENGTH) {
        throw new Error(`Variável de ambiente inválida: INVITE_CODE deve ter no mínimo ${INVITE_CODE_MIN_LENGTH} caracteres.`);
    }
    return value;
}
function parsePort(value) {
    if (value === undefined || value.trim() === '')
        return 3333;
    const port = Number(value);
    if (!Number.isInteger(port) || port < 1 || port > 65_535) {
        throw new Error('Variável de ambiente inválida: PORT');
    }
    return port;
}
function parseIntegerInRange(value, defaultValue, name, minimum, maximum) {
    if (value === undefined || value.trim() === '')
        return defaultValue;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
        throw new Error(`Variável de ambiente inválida: ${name}`);
    }
    return parsed;
}
function parseDecimalInRange(value, defaultValue, name, minimum, maximum) {
    if (value === undefined || value.trim() === '')
        return defaultValue;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < minimum || parsed > maximum) {
        throw new Error(`Variável de ambiente inválida: ${name}`);
    }
    return parsed;
}
function parseCorsAllowedOrigins(value) {
    if (value === undefined || value.trim() === '')
        return [];
    return [...new Set(value.split(',').map((entry) => entry.trim()).filter(Boolean).map((entry) => {
            if (entry === '*')
                throw new Error('Variável de ambiente inválida: CORS_ALLOWED_ORIGINS');
            let parsed;
            try {
                parsed = new URL(entry);
            }
            catch {
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
export function createEnv(environment) {
    return {
        DATABASE_URL: required(environment, 'DATABASE_URL'),
        JWT_SECRET: requireJwtSecret(environment),
        GEMINI_API_KEY: required(environment, 'GEMINI_API_KEY'),
        // Cadastro controlado durante o piloto (P4-03, decisão de P0-01): shared secret
        // de entrada, não versionado. Nunca lido diretamente de env dentro do use case.
        INVITE_CODE: requireInviteCode(environment),
        PORT: parsePort(environment.PORT),
        GEMINI_TIMEOUT_MS: parseIntegerInRange(environment.GEMINI_TIMEOUT_MS, 30_000, 'GEMINI_TIMEOUT_MS', 1_000, 30_000),
        GEMINI_MAX_ATTEMPTS: parseIntegerInRange(environment.GEMINI_MAX_ATTEMPTS, 2, 'GEMINI_MAX_ATTEMPTS', 1, 2),
        TRUST_PROXY_HOPS: parseIntegerInRange(environment.TRUST_PROXY_HOPS, 0, 'TRUST_PROXY_HOPS', 0, 10),
        CORS_ALLOWED_ORIGINS: parseCorsAllowedOrigins(environment.CORS_ALLOWED_ORIGINS),
        REQUEST_TIMEOUT_MS: parseIntegerInRange(environment.REQUEST_TIMEOUT_MS, 120_000, 'REQUEST_TIMEOUT_MS', 30_000, 300_000),
        SHUTDOWN_TIMEOUT_MS: parseIntegerInRange(environment.SHUTDOWN_TIMEOUT_MS, 30_000, 'SHUTDOWN_TIMEOUT_MS', 1_000, 120_000),
        // Fonte única do limiar de similaridade: mesmo valor usado no prompt e na decisão em código (M6-02).
        SIMILARITY_CONFIDENCE_THRESHOLD: parseDecimalInRange(environment.SIMILARITY_CONFIDENCE_THRESHOLD, 0.7, 'SIMILARITY_CONFIDENCE_THRESHOLD', 0, 1),
        // Teto operacional do piloto (D1, docs/pilot-decisions.md), não regra fiscal.
        // Fonte única: mesmo valor usado no maxItems do prompt e na validação do schema (P4-01).
        DANFE_MAX_ITEMS: parseIntegerInRange(environment.DANFE_MAX_ITEMS, 100, 'DANFE_MAX_ITEMS', 1, 1000),
    };
}
export const env = createEnv(process.env);
//# sourceMappingURL=env.js.map