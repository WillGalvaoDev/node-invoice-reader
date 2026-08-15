export class StockMapper {
    static toDomain(raw) {
        return {
            id: raw.id,
            name: raw.name,
            companyId: raw.companyId,
            createdAt: raw.createdAt,
        };
    }
}
//# sourceMappingURL=stock.mapper.js.map