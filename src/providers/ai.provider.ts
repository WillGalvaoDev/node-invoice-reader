export interface IProductItemResult {
  code: string;         // Código do produto (SKU / EAN)
  description: string;  // Nome/Descrição do produto
  quantity: number;     // Quantidade comprada (crucial para o estoque)
  unitPrice: number;    // Valor unitário
  totalPrice: number;   // Valor total do item
  unitMeasurement: string; // UN, KG, LT, CX (importante para o estoque)
}

export interface ISupplierResult {
  cnpj: string;
  name: string;
  stateRegistration: string; // Inscrição Estadual (IE)
}

export interface IDanfeExtractResult {
  accessKey: string;
  invoiceNumber: string;
  series: string;
  issuedAt: Date;
  totalValue: number;
  supplier: ISupplierResult;       // Objeto aninhado com dados do fornecedor
  products: IProductItemResult[];  // Array (lista) com todos os produtos da nota
}

export interface IAiProvider {
  extractDanfeData(filePath: string): Promise<IDanfeExtractResult>;
}