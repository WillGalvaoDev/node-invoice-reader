import { ProductMapper } from '../mappers/product.mapper.js';
import { prisma } from '../infra/prisma.js';
import { AppError } from '../errors/app-error.js';
import { isPrismaErrorCode } from '../errors/prisma-error.js';
export class PrismaProductRepository {
    async save(product) {
        let createdProduct;
        try {
            createdProduct = await prisma.product.create({
                data: {
                    code: product.code,
                    description: product.description,
                    quantity: Number(product.quantity),
                    unitMeasurement: product.unitMeasurement,
                    unitPrice: Number(product.unitPrice),
                    totalPrice: Number(product.totalPrice),
                    stockId: product.stockId,
                    userId: product.userId ?? null,
                },
            });
        }
        catch (error) {
            if (isPrismaErrorCode(error, 'P2002')) {
                throw new AppError('Produto já cadastrado neste estoque.', 409);
            }
            if (isPrismaErrorCode(error, 'P2003')) {
                throw new AppError('Estoque ou usuário relacionado inválido.', 400);
            }
            throw error;
        }
        return ProductMapper.toDomain(createdProduct);
    }
    async findByCode(code, stockId) {
        const product = await prisma.product.findUnique({
            where: { stockId_code: { stockId, code } },
        });
        if (!product)
            return null;
        return ProductMapper.toDomain(product);
    }
    async findByStockId(stockId) {
        const products = await prisma.product.findMany({
            where: { stockId },
            orderBy: { createdAt: 'desc' },
        });
        return products.map(ProductMapper.toDomain);
    }
    async findPageByStockId({ stockId, limit, cursor }) {
        const products = await prisma.product.findMany({
            where: { stockId },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            take: limit + 1,
            ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        });
        const items = products.slice(0, limit).map(ProductMapper.toDomain);
        return { items, nextCursor: products.length > limit ? items.at(-1)?.id ?? null : null };
    }
    async findById(id) {
        const product = await prisma.product.findUnique({
            where: { id },
        });
        if (!product)
            return null;
        return ProductMapper.toDomain(product);
    }
    async update(id, data) {
        let updatedProduct;
        try {
            updatedProduct = await prisma.product.update({
                where: { id },
                data: {
                    ...(data.code !== undefined && { code: data.code }),
                    ...(data.description !== undefined && { description: data.description }),
                    ...(data.quantity !== undefined && { quantity: Number(data.quantity) }),
                    ...(data.unitMeasurement !== undefined && { unitMeasurement: data.unitMeasurement }),
                    ...(data.unitPrice !== undefined && { unitPrice: Number(data.unitPrice) }),
                    ...(data.totalPrice !== undefined && { totalPrice: Number(data.totalPrice) }),
                    ...(data.stockId !== undefined && { stockId: data.stockId }),
                    ...(data.userId !== undefined && { userId: data.userId ?? null }),
                },
            });
        }
        catch (error) {
            if (isPrismaErrorCode(error, 'P2002')) {
                throw new AppError('Produto já cadastrado neste estoque.', 409);
            }
            if (isPrismaErrorCode(error, 'P2003')) {
                throw new AppError('Estoque ou usuário relacionado inválido.', 400);
            }
            throw error;
        }
        return ProductMapper.toDomain(updatedProduct);
    }
    async delete(id) {
        try {
            await prisma.product.delete({ where: { id } });
        }
        catch (error) {
            if (isPrismaErrorCode(error, 'P2003')) {
                throw new AppError('Produto possui referências e não pode ser removido.', 409);
            }
            throw error;
        }
    }
}
//# sourceMappingURL=prisma-product.repository.js.map