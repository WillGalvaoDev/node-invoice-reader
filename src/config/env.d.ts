import 'dotenv/config';
type Environment = NodeJS.ProcessEnv | Record<string, string | undefined>;
export declare function createEnv(environment: Environment): {
    DATABASE_URL: string;
    JWT_SECRET: string;
    GEMINI_API_KEY: string;
    PORT: number;
    GEMINI_TIMEOUT_MS: number;
    GEMINI_MAX_ATTEMPTS: number;
    TRUST_PROXY_HOPS: number;
    CORS_ALLOWED_ORIGINS: string[];
    REQUEST_TIMEOUT_MS: number;
    SHUTDOWN_TIMEOUT_MS: number;
    SIMILARITY_CONFIDENCE_THRESHOLD: number;
};
export declare const env: {
    DATABASE_URL: string;
    JWT_SECRET: string;
    GEMINI_API_KEY: string;
    PORT: number;
    GEMINI_TIMEOUT_MS: number;
    GEMINI_MAX_ATTEMPTS: number;
    TRUST_PROXY_HOPS: number;
    CORS_ALLOWED_ORIGINS: string[];
    REQUEST_TIMEOUT_MS: number;
    SHUTDOWN_TIMEOUT_MS: number;
    SIMILARITY_CONFIDENCE_THRESHOLD: number;
};
export {};
//# sourceMappingURL=env.d.ts.map