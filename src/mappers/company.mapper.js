export class CompanyMapper {
    static toDomain(raw) {
        return {
            id: raw.id,
            name: raw.name,
            cnpj: raw.cnpj,
            ownerId: raw.ownerId,
            createdAt: raw.createdAt,
        };
    }
}
//# sourceMappingURL=company.mapper.js.map