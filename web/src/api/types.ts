// Contratos da API (envelope `data`), espelhando os controllers do backend.

export type DocumentKind = 'initial' | 'followup';

export interface DemoDocument {
  kind: DocumentKind;
  filename: string;
  url: string;
}

export interface ExpectedResult {
  summary: string;
  products: Array<{ code: string; quantity: number }>;
}

export interface DemoSession {
  id: string;
  companyId: string;
  stockId: string;
  state: 'ACTIVE' | 'ARCHIVED';
  createdAt: string;
  documents: DemoDocument[];
  expectedResults: Record<DocumentKind, ExpectedResult>;
}

export interface Product {
  id: string;
  code: string;
  description: string;
  quantity: number;
  unitMeasurement: string;
  unitPrice: number;
  totalPrice: number;
  sourceSupplierCnpj?: string | null;
}

export interface ProductPage {
  items: Product[];
  nextCursor: string | null;
}

export interface InvoiceItem {
  code: string;
  description: string;
  quantity: number;
  unitMeasurement: string;
  unitPrice: number;
  totalPrice: number;
}

export interface UploadedSuggestion {
  id: string;
  status: 'PENDING';
  invoiceItem: InvoiceItem;
  suggestedProduct: Product;
  confidence: number;
  reason: string;
}

export interface UploadResult {
  invoice: { invoiceNumber: string; supplier: { cnpj: string; name: string } };
  processedProducts: Product[];
  suggestions: UploadedSuggestion[];
}

export interface PendingSuggestion {
  id: string;
  stockId: string;
  suggestedProductId: string;
  receivedCode: string;
  receivedDescription: string;
  receivedQuantity: number;
  receivedUnitPrice: number;
  unitMeasurement: string;
  receivedSupplierCnpj: string | null;
  confidence: number;
  reason: string;
  status: 'PENDING' | 'CONFIRMED' | 'REJECTED';
}
