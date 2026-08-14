export interface IStock {
    id?: string;
    name: string;
    companyId: string;
    createdAt?: Date;
}
export interface IStockRepository {
    create(stock: IStock): Promise<IStock>;
    findById(id: string): Promise<IStock | null>;
    findByIdForUser(id: string, userId: string): Promise<IStock | null>;
    findByIdForViewer(id: string, userId: string): Promise<IStock | null>;
    findByCompanyId(companyId: string): Promise<IStock[]>;
}
//# sourceMappingURL=stock.repository.d.ts.map