/**
 * Deliberadamente separado de env.ts: importar qualquer coisa de env.js
 * dispara `createEnv(process.env)` no carregamento do módulo (linha final de
 * env.ts), exigindo JWT_SECRET e GEMINI_API_KEY mesmo para só ler
 * DATABASE_URL. prisma.config.ts (rodado por `prisma migrate`/`validate`/
 * `generate`) não deve precisar de nenhum dos dois (P5-01).
 */
export function resolveDatabaseUrl(environment) {
    const value = environment.DATABASE_URL?.trim();
    if (!value) {
        throw new Error('Variável de ambiente obrigatória ausente: DATABASE_URL');
    }
    return value;
}
//# sourceMappingURL=database-url.js.map