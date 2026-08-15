export class InMemoryCompanyRepository {
    items = [];
    stocks = [];
    failNextStockCreation = false;
    async create(company) {
        const newCompany = {
            id: company.id ?? `company-${this.items.length + 1}`,
            name: company.name,
            cnpj: company.cnpj ?? null,
            ownerId: company.ownerId,
            createdAt: company.createdAt ?? new Date(),
        };
        this.items.push(newCompany);
        return newCompany;
    }
    async createWithDefaultStock(company, defaultStockName) {
        if (this.failNextStockCreation) {
            this.failNextStockCreation = false;
            throw new Error('Simulated stock creation failure');
        }
        const newCompany = {
            id: company.id ?? `company-${this.items.length + 1}`,
            name: company.name,
            cnpj: company.cnpj,
            ownerId: company.ownerId,
            createdAt: company.createdAt ?? new Date(),
        };
        const newStock = {
            id: `stock-${this.stocks.length + 1}`,
            name: defaultStockName,
            companyId: newCompany.id,
            createdAt: new Date(),
        };
        this.items.push(newCompany);
        this.stocks.push(newStock);
        return { company: newCompany, stock: newStock };
    }
    async findById(id) {
        const company = this.items.find((item) => item.id === id);
        return company ?? null;
    }
    async findByOwnerId(ownerId) {
        return this.items.filter((item) => item.ownerId === ownerId);
    }
    // 👈 Método adicionado:
    async findByCnpj(cnpj) {
        const company = this.items.find((item) => item.cnpj === cnpj);
        return company ?? null;
    }
}
//# sourceMappingURL=in-memory-company.repository.js.map