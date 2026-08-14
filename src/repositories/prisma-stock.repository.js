import { prisma } from '../infra/prisma.js';
import { AppError } from '../errors/app-error.js';
import { isPrismaErrorCode } from '../errors/prisma-error.js';
export class PrismaStockRepository {
    async create(stock) {
        let createdStock;
        try {
            createdStock = await prisma.stock.create({
                data: {
                    name: stock.name,
                    companyId: stock.companyId,
                },
            });
        }
        catch (error) {
            if (isPrismaErrorCode(error, 'P2002')) {
                throw new AppError('Já existe um estoque com este nome nesta empresa.', 409);
            }
            if (isPrismaErrorCode(error, 'P2003')) {
                throw new AppError('Empresa relacionada inválida.', 400);
            }
            throw error;
        }
        return createdStock;
    }
    async findById(id) {
        const stock = await prisma.stock.findUnique({
            where: { id },
        });
        return stock;
    }
    async findByIdForUser(id, userId) {
        const stock = await prisma.stock.findFirst({
            where: {
                id,
                company: {
                    OR: [
                        { ownerId: userId },
                        {
                            collaborators: {
                                some: {
                                    userId,
                                    permissions: {
                                        some: { stockId: id, canCreate: true },
                                    },
                                },
                            },
                        },
                    ],
                },
            },
        });
        return stock;
    }
    async findByIdForViewer(id, userId) {
        const stock = await prisma.stock.findFirst({
            where: {
                id,
                company: {
                    OR: [
                        { ownerId: userId },
                        {
                            collaborators: {
                                some: {
                                    userId,
                                    permissions: { some: { stockId: id, canView: true } },
                                },
                            },
                        },
                    ],
                },
            },
        });
        return stock;
    }
    async findByCompanyId(companyId) {
        const stocks = await prisma.stock.findMany({
            where: { companyId },
            orderBy: { createdAt: 'desc' },
        });
        return stocks;
    }
}
//# sourceMappingURL=prisma-stock.repository.js.map