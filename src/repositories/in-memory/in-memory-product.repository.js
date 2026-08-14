export class InMemoryProductRepository {
    items = [];
    async save(product) {
        const newProduct = {
            id: product.id ?? `product-${this.items.length + 1}`,
            code: product.code,
            ean: product.ean ?? null,
            ncm: product.ncm ?? null,
            description: product.description,
            quantity: product.quantity,
            unitMeasurement: product.unitMeasurement,
            unitPrice: product.unitPrice,
            totalPrice: product.totalPrice,
            stockId: product.stockId,
            userId: product.userId ?? null,
            createdAt: product.createdAt ?? new Date(),
        };
        this.items.push(newProduct);
        return newProduct;
    }
    async findByCode(code, stockId) {
        return this.items.find((item) => item.code === code && item.stockId === stockId) ?? null;
    }
    async findByStockId(stockId) {
        return this.items.filter((item) => item.stockId === stockId);
    }
    async findPageByStockId({ stockId, limit, cursor }) {
        const ordered = this.items.filter((item) => item.stockId === stockId).sort((left, right) => {
            const byCreatedAt = (right.createdAt?.getTime() ?? 0) - (left.createdAt?.getTime() ?? 0);
            return byCreatedAt || (right.id ?? '').localeCompare(left.id ?? '');
        });
        const cursorIndex = cursor ? ordered.findIndex((item) => item.id === cursor) : -1;
        const pageWithExtra = ordered.slice(cursorIndex + 1, cursorIndex + 1 + limit + 1);
        const items = pageWithExtra.slice(0, limit);
        return { items, nextCursor: pageWithExtra.length > limit ? items.at(-1)?.id ?? null : null };
    }
    async findById(id) {
        return this.items.find((item) => item.id === id) ?? null;
    }
    async update(id, data) {
        const index = this.items.findIndex((item) => item.id === id);
        if (index === -1)
            throw new Error('Product not found');
        const updatedProduct = { ...this.items[index], ...data };
        this.items[index] = updatedProduct;
        return updatedProduct;
    }
    async delete(id) {
        this.items = this.items.filter((item) => item.id !== id);
    }
}
//# sourceMappingURL=in-memory-product.repository.js.map