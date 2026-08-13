import { prisma } from '../infra/prisma.js';
import { AppError } from '../errors/app-error.js';
import { isPrismaErrorCode } from '../errors/prisma-error.js';
export class PrismaCompanyRepository {
    async create(company) {
        let createdCompany;
        try {
            createdCompany = await prisma.company.create({
                data: {
                    name: company.name,
                    cnpj: company.cnpj,
                    ownerId: company.ownerId,
                },
            });
        }
        catch (error) {
            if (isPrismaErrorCode(error, 'P2002')) {
                throw new AppError('Já existe uma empresa cadastrada com este CNPJ.', 409);
            }
            if (isPrismaErrorCode(error, 'P2003')) {
                throw new AppError('Usuário responsável inválido.', 400);
            }
            throw error;
        }
        return createdCompany;
    }
    async findById(id) {
        const company = await prisma.company.findUnique({
            where: { id },
        });
        return company;
    }
    async findByOwnerId(ownerId) {
        const companies = await prisma.company.findMany({
            where: { ownerId },
            orderBy: { createdAt: 'desc' },
        });
        return companies;
    }
    // 👈 Método adicionado:
    async findByCnpj(cnpj) {
        const company = await prisma.company.findUnique({
            where: { cnpj },
        });
        return company;
    }
}
//# sourceMappingURL=prisma-company.repository.js.map