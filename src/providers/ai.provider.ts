import type { IProduct } from '../repositories/product.repository.js';
import type { DanfeMimeType } from '../config/upload.js';

export interface IProductItemResult {
  code: string;           // Código do produto (SKU / EAN)
  description: string;    // Nome/Descrição do produto
  quantity: number;       // Quantidade comprada (crucial para o estoque)
  unitPrice: number;      // Valor unitário
  totalPrice: number;     // Valor total do item
  unitMeasurement: string;// UN, KG, LT, CX (importante para o estoque)
}

export interface ISupplierResult {
  cnpj: string;
  name: string;
  stateRegistration?: string | undefined; // Inscrição Estadual (IE), quando presente
}

export interface IDanfeExtractResult {
  accessKey: string;
  invoiceNumber: string;
  series: string;
  issuedAt: Date;
  totalValue: number;
  supplier: ISupplierResult;      // Objeto aninhado com dados do fornecedor
  products: IProductItemResult[]; // Array (lista) com todos os produtos da nota
}

export interface ISimilarityMatch {
  product: IProduct;
  confidence: number; // Ex: 0.85 (85% de certeza)
  reason: string;     // Ex: "Descrição muito similar a Ovos Caipira Dúzia"
}

export interface IAiProvider {
  extractDanfeData(content: Buffer, mimeType: DanfeMimeType, context?: { requestId?: string }): Promise<IDanfeExtractResult>;
  findSimilarProduct(
    newItemDescription: string,
    existingProducts: IProduct[],
    context?: { requestId?: string },
  ): Promise<ISimilarityMatch | null>;
}
