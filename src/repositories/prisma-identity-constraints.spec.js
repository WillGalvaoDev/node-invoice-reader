import { beforeEach, describe, expect, it, vi } from 'vitest';
const prismaMock = vi.hoisted(() => ({
    company: { create: vi.fn() },
    user: { create: vi.fn() },
}));
vi.mock('../infra/prisma.js', () => ({ prisma: prismaMock }));
const { PrismaCompanyRepository } = await import('./prisma-company.repository.js');
const { PrismaUserRepository } = await import('./prisma-user.repository.js');
describe('Prisma identity constraint translation', () => {
    beforeEach(() => vi.clearAllMocks());
    it('traduz a corrida final da UNIQUE de CNPJ para 409', async () => {
        prismaMock.company.create.mockRejectedValueOnce({
            code: 'P2002', meta: { target: ['cnpj'], modelName: 'Company' },
        });
        await expect(new PrismaCompanyRepository().create({
            name: 'Empresa', cnpj: '11222333000181', ownerId: 'owner-a',
        })).rejects.toMatchObject({
            name: 'AppError', statusCode: 409,
            message: 'Já existe uma empresa cadastrada com este CNPJ.',
        });
    });
    it('traduz a corrida final da UNIQUE de email para 409', async () => {
        prismaMock.user.create.mockRejectedValueOnce({
            code: 'P2002', meta: { target: ['email'], modelName: 'User' },
        });
        await expect(new PrismaUserRepository().create({
            name: 'User', email: 'duplicate@example.com', password: 'hash',
        })).rejects.toMatchObject({
            name: 'AppError', statusCode: 409,
            message: 'Já existe um usuário cadastrado com este email.',
        });
    });
    it('traduz FK inválida de owner na criação de company para 400', async () => {
        prismaMock.company.create.mockRejectedValueOnce({
            code: 'P2003', meta: { field_name: 'ownerId' },
        });
        await expect(new PrismaCompanyRepository().create({
            name: 'Empresa', cnpj: '11222333000181', ownerId: 'missing-owner',
        })).rejects.toMatchObject({
            name: 'AppError', statusCode: 400,
            message: 'Usuário responsável inválido.',
        });
    });
});
//# sourceMappingURL=prisma-identity-constraints.spec.js.map