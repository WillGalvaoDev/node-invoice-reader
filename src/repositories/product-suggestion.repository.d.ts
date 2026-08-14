export type ProductSuggestionStatus = 'PENDING' | 'CONFIRMED' | 'REJECTED';
export interface IProductSimilaritySuggestion {
    id: string;
    processedInvoiceId: string;
    itemIndex: number;
    stockId: string;
    suggestedProductId: string;
    receivedCode: string;
    receivedDescription: string;
    receivedQuantity: number;
    receivedUnitPrice: number;
    unitMeasurement: string;
    confidence: number;
    reason: string;
    status: ProductSuggestionStatus;
    decidedAt: Date | null;
    decidedByUserId: string | null;
    createdAt: Date;
}
export interface IProductSuggestionRepository {
    findById(id: string): Promise<IProductSimilaritySuggestion | null>;
    findPendingByStockId(stockId: string): Promise<IProductSimilaritySuggestion[]>;
    confirm(id: string, userId: string): Promise<IProductSimilaritySuggestion>;
    reject(id: string, userId: string): Promise<IProductSimilaritySuggestion>;
}
//# sourceMappingURL=product-suggestion.repository.d.ts.map