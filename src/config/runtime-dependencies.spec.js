import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
describe('dependências de runtime', () => {
    it('declara dotenv diretamente em dependencies', async () => {
        const packageJson = JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8'));
        expect(packageJson.dependencies?.dotenv).toBeDefined();
        expect(packageJson.devDependencies?.dotenv).toBeUndefined();
    });
    it('mantém leitura de ambiente e carregamento do dotenv no módulo central', async () => {
        const files = await Promise.all([
            '../infra/prisma.ts',
            '../providers/implementations/jose-token.provider.ts',
            '../providers/gemini-ai.provider.ts',
            '../index.ts',
        ].map((path) => readFile(new URL(path, import.meta.url), 'utf8')));
        const envModule = await readFile(new URL('./env.ts', import.meta.url), 'utf8');
        expect(files.join('\n')).not.toMatch(/process\.env|dotenv\/config/);
        expect(envModule.match(/dotenv\/config/g)).toHaveLength(1);
        expect(envModule.match(/process\.env/g)).toHaveLength(1);
    });
});
//# sourceMappingURL=runtime-dependencies.spec.js.map