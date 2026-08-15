export class InMemoryStockRepository {
    items = [];
    createAuthorizedUserIds = new Map();
    viewAuthorizedUserIds = new Map();
    // companyId -> ownerId. Owner é viewer implícito, independente de qualquer
    // entrada em viewAuthorizedUserIds — mesma invariante da query Prisma real (P1-02).
    companyOwnerId = new Map();
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
    isViewable(stock, userId) {
        if (this.companyOwnerId.get(stock.companyId) === userId)
            return true;
        return this.viewAuthorizedUserIds.get(stock.id)?.has(userId) ?? false;
    }
    async findByIdForViewer(id, userId) {
        const stock = this.items.find((item) => item.id === id);
        if (!stock || !this.isViewable(stock, userId))
            return null;
        return stock;
    }
    async findViewablePageByCompanyId({ companyId, userId, limit, cursor }) {
        const ordered = this.items
            .filter((item) => item.companyId === companyId && this.isViewable(item, userId))
            .sort((left, right) => {
            const byCreatedAt = (right.createdAt?.getTime() ?? 0) - (left.createdAt?.getTime() ?? 0);
            return byCreatedAt || (right.id ?? '').localeCompare(left.id ?? '');
        });
        const cursorIndex = cursor ? ordered.findIndex((item) => item.id === cursor) : -1;
        const pageWithExtra = ordered.slice(cursorIndex + 1, cursorIndex + 1 + limit + 1);
        const items = pageWithExtra.slice(0, limit);
        return { items, nextCursor: pageWithExtra.length > limit ? items.at(-1)?.id ?? null : null };
    }
}
//# sourceMappingURL=in-memory-stock.repository.js.map