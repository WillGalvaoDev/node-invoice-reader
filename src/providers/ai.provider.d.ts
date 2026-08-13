import type { IProduct } from '../repositories/product.repository.js';
import type { DanfeMimeType } from '../config/upload.js';
export interface IProductItemResult {
    code: string;
    description: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    unitMeasurement: string;
}
export interface ISupplierResult {
    cnpj: string;
    name: string;
    stateRegistration?: string | undefined;
}
export interface IDanfeExtractResult {
    accessKey: string;
    invoiceNumber: string;
    series: string;
    issuedAt: Date;
    totalValue: number;
    supplier: ISupplierResult;
    products: IProductItemResult[];
}
export interface ISimilarityMatch {
    product: IProduct;
    confidence: number;
    reason: string;
}
export interface IAiProvider {
    extractDanfeData(filePath: string, mimeType: DanfeMimeType): Promise<IDanfeExtractResult>;
    findSimilarProduct(newItemDescription: string, existingProducts: IProduct[]): Promise<ISimilarityMatch | null>;
}
//# sourceMappingURL=ai.provider.d.ts.map