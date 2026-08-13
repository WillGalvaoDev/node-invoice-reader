import { beforeEach, describe, expect, it, vi } from 'vitest';
const infrastructure = vi.hoisted(() => ({
    pool: { end: vi.fn() },
    adapter: { kind: 'adapter' },
    prisma: { $disconnect: vi.fn() },
    Pool: vi.fn(),
    PrismaPg: vi.fn(),
    PrismaClient: vi.fn(),
}));
vi.mock('pg', () => ({
    Pool: infrastructure.Pool.mockImplementation(function () {
        return infrastructure.pool;
    }),
}));
vi.mock('@prisma/adapter-pg', () => ({
    PrismaPg: infrastructure.PrismaPg.mockImplementation(function () {
        return infrastructure.adapter;
    }),
}));
vi.mock('@prisma/client', () => ({
    PrismaClient: infrastructure.PrismaClient.mockImplementation(function () {
        return infrastructure.prisma;
    }),
}));
vi.mock('../config/env.js', () => ({
    env: {
        DATABASE_URL: 'postgresql://localhost/docscan',
        JWT_SECRET: 'jwt-secret',
        GEMINI_API_KEY: 'gemini-key',
        PORT: 3333,
    },
}));
describe('infraestrutura Prisma', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();
    });
    it('compartilha um único pool, adapter e PrismaClient entre todos os repositórios', async () => {
        await Promise.all([
            import('../repositories/prisma-product.repository.js'),
            import('../repositories/prisma-user.repository.js'),
            import('../repositories/prisma-stock.repository.js'),
            import('../repositories/prisma-company.repository.js'),
            import('../repositories/prisma-audit-log.repository.js'),
        ]);
        expect(infrastructure.Pool).toHaveBeenCalledTimes(1);
        expect(infrastructure.PrismaPg).toHaveBeenCalledTimes(1);
        expect(infrastructure.PrismaPg).toHaveBeenCalledWith(infrastructure.pool);
        expect(infrastructure.PrismaClient).toHaveBeenCalledTimes(1);
        expect(infrastructure.PrismaClient).toHaveBeenCalledWith({
            adapter: infrastructure.adapter,
        });
    });
    it('limita explicitamente o pool compartilhado a dez conexões', async () => {
        await import('./prisma.js');
        expect(infrastructure.Pool).toHaveBeenCalledWith({
            connectionString: 'postgresql://localhost/docscan',
            max: 10,
        });
    });
    it('expõe encerramento limpo do PrismaClient e do pool', async () => {
        const { disconnectPrisma } = await import('./prisma.js');
        await disconnectPrisma();
        expect(infrastructure.prisma.$disconnect).toHaveBeenCalledOnce();
        expect(infrastructure.pool.end).toHaveBeenCalledOnce();
    });
});
//# sourceMappingURL=prisma.spec.js.map