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
  // P3-01: liga a nota ao custo/telemetria em ai_call_events, nunca em log.
  correlationId?: string;
}

export interface IInvoicePersistenceRepository {
  persist(plan: IInvoicePersistencePlan): Promise<IProduct[]>;
}
