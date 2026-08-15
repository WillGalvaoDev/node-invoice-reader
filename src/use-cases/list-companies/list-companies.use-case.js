import { AppError } from '../../errors/app-error.js';
export class ListCompaniesUseCase {
    companyRepository;
    constructor(companyRepository) {
        this.companyRepository = companyRepository;
    }
    async execute({ userId, limit, cursor }) {
        if (cursor) {
            const cursorCompany = await this.companyRepository.findAccessibleById(cursor, userId);
            if (!cursorCompany)
                throw new AppError('Cursor de empresa inválido.', 400);
        }
        const page = await this.companyRepository.findAccessiblePageByUserId({ userId, limit, cursor });
        return {
            items: page.items.map((company) => this.toAccessibleCompany(company, userId)),
            nextCursor: page.nextCursor,
        };
    }
    // Role é derivada em memória (ownerId === userId), sem query adicional: o
    // predicado de acesso já foi resolvido pelo repositório.
    toAccessibleCompany(company, userId) {
        return {
            id: company.id,
            name: company.name,
            cnpj: company.cnpj,
            createdAt: company.createdAt,
            role: company.ownerId === userId ? 'OWNER' : 'COLLABORATOR',
        };
    }
}
//# sourceMappingURL=list-companies.use-case.js.map