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
/** Os três números que descrevem uma posição de estoque — o suficiente para auditar (P3-00A). */
export interface IDecidedProductFigures {
    quantity: number;
    unitPrice: number;
    totalPrice: number;
}
/**
 * Resultado de uma decisão (confirm/reject) enriquecido com o produto afetado,
 * antes e depois — dado que só a transação da decisão possui, necessário para
 * o use case auditar sem reintroduzir uma leitura fora da transação (P3-00A).
 */
export interface IProductSuggestionDecision {
    suggestion: IProductSimilaritySuggestion;
    productId: string;
    previousProduct: IDecidedProductFigures | null;
    nextProduct: IDecidedProductFigures;
}
export interface IProductSuggestionRepository {
    findById(id: string): Promise<IProductSimilaritySuggestion | null>;
    findPendingByStockId(stockId: string): Promise<IProductSimilaritySuggestion[]>;
    confirm(id: string, userId: string): Promise<IProductSuggestionDecision>;
    reject(id: string, userId: string): Promise<IProductSuggestionDecision>;
}
//# sourceMappingURL=product-suggestion.repository.d.ts.map