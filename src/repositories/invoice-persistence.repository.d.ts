import type { IProduct } from './product.repository.js';
export interface IInvoiceProductOperation {
    product: IProduct;
}
export interface IInvoiceSuggestionOperation {
    id: string;
    itemIndex: number;
    suggestedProductId: string;
    receivedCode: string;
    receivedDescription: string;
    receivedQuantity: number;
    receivedUnitPrice: number;
    unitMeasurement: string;
    confidence: number;
    reason: string;
}
export interface IInvoicePersistencePlan {
    accessKey: string;
    stockId: string;
    operations: IInvoiceProductOperation[];
    suggestions?: IInvoiceSuggestionOperation[];
    correlationId?: string;
}
export interface IInvoicePersistenceRepository {
    persist(plan: IInvoicePersistencePlan): Promise<IProduct[]>;
}
//# sourceMappingURL=invoice-persistence.repository.d.ts.map