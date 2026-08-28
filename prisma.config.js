import 'dotenv/config';
import { defineConfig } from 'prisma/config';
import { resolveDatabaseUrl } from './src/config/database-url.js';
// P5-01: lê DATABASE_URL diretamente, sem importar env.ts — importar qualquer
// exportação de env.js dispararia createEnv(process.env) inteiro, exigindo
// JWT_SECRET e GEMINI_API_KEY só para rodar uma migration. O import de
// dotenv/config é próprio (não herdado de env.ts): sem ele, `.env` local
// nunca seria carregado e prisma generate/validate/migrate quebrariam fora
// de um ambiente que já exporta DATABASE_URL (ex.: o build do Render).
export default defineConfig({
    schema: "prisma/schema.prisma",
    datasource: {
        url: resolveDatabaseUrl(process.env),
    },
    migrations: {
        path: "prisma/migrations",
    },
});
//# sourceMappingURL=prisma.config.js.map