export class InMemoryStockRepository {
    items = [];
    createAuthorizedUserIds = new Map();
    viewAuthorizedUserIds = new Map();
    async create(stock) {
        const newStock = {
            id: stock.id ?? `stock-${this.items.length + 1}`,
            name: stock.name,
            companyId: stock.companyId,
            createdAt: stock.createdAt ?? new Date(),
        };
        this.items.push(newStock);
        return newStock;
    }
    async findById(id) {
        const stock = this.items.find((item) => item.id === id);
        return stock ?? null;
    }
    async findByIdForUser(id, userId) {
        const authorizedUsers = this.createAuthorizedUserIds.get(id);
        if (!authorizedUsers?.has(userId))
            return null;
        return this.findById(id);
    }
    async findByIdForViewer(id, userId) {
        const authorizedUsers = this.viewAuthorizedUserIds.get(id);
        if (!authorizedUsers?.has(userId))
            return null;
        return this.findById(id);
    }
    async findByCompanyId(companyId) {
        return this.items.filter((item) => item.companyId === companyId);
    }
}
//# sourceMappingURL=in-memory-stock.repository.js.map