type Environment = NodeJS.ProcessEnv | Record<string, string | undefined>;
/**
 * Deliberadamente separado de env.ts: importar qualquer coisa de env.js
 * dispara `createEnv(process.env)` no carregamento do módulo (linha final de
 * env.ts), exigindo JWT_SECRET e GEMINI_API_KEY mesmo para só ler
 * DATABASE_URL. prisma.config.ts (rodado por `prisma migrate`/`validate`/
 * `generate`) não deve precisar de nenhum dos dois (P5-01).
 */
export declare function resolveDatabaseUrl(environment: Environment): string;
export {};
//# sourceMappingURL=database-url.d.ts.map