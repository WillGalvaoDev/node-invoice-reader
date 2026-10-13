import { createHash } from 'node:crypto';

export const DEMO_DOCUMENT_KINDS = ['initial', 'followup'] as const;
export type DemoDocumentKind = typeof DEMO_DOCUMENT_KINDS[number];

export interface IDemoInvoiceItem {
  code: string;
  description: string;
  quantity: number;
  unitMeasurement: string;
  unitPrice: number;
  totalPrice: number;
}

export interface IDemoInvoice {
  accessKey: string;
  invoiceNumber: string;
  series: string;
  issuedAt: string;
  totalValue: number;
  supplier: { cnpj: string; name: string };
  products: IDemoInvoiceItem[];
}

export const DEMO_DOCUMENT_FILENAMES: Record<DemoDocumentKind, string> = {
  initial: 'demo-inicial.pdf',
  followup: 'demo-completa.pdf',
};

const SUPPLIER = { cnpj: '11222333000181', name: 'Fornecedor Sintetico DocScan' };

/**
 * Espelho de examples/demo/scenario.json (verificado por teste). Embutido para o
 * serviço não depender de arquivos fora do artefato compilado.
 */
export const DEMO_SCENARIO: Record<DemoDocumentKind, IDemoInvoice> = {
  initial: {
    accessKey: '11111111111111111111111111111111111111111111',
    invoiceNumber: '1',
    series: '999',
    issuedAt: '2026-10-10',
    totalValue: 20,
    supplier: SUPPLIER,
    products: [
      { code: 'CAN-A', description: 'Caneta esferografica azul', quantity: 10, unitMeasurement: 'UN', unitPrice: 2, totalPrice: 20 },
    ],
  },
  followup: {
    accessKey: '22222222222222222222222222222222222222222222',
    invoiceNumber: '2',
    series: '999',
    issuedAt: '2026-10-10',
    totalValue: 25,
    supplier: SUPPLIER,
    products: [
      { code: 'CAN-A', description: 'Caneta esferografica azul', quantity: 2, unitMeasurement: 'UN', unitPrice: 2, totalPrice: 4 },
      { code: 'CAD-A', description: 'Caderno capa dura', quantity: 1, unitMeasurement: 'UN', unitPrice: 15, totalPrice: 15 },
      { code: 'CAN-B', description: 'Caneta esferografica azul', quantity: 3, unitMeasurement: 'UN', unitPrice: 2, totalPrice: 6 },
    ],
  },
};

/** Mesmo algoritmo de scripts/generate-demo-pdfs.py: sha256(...) mod 10^44, 44 dígitos. */
export function deriveDemoAccessKey(sessionId: string, kind: DemoDocumentKind): string {
  const digest = createHash('sha256').update(`docscan-demo:${sessionId}:${kind}`).digest('hex');
  return (BigInt(`0x${digest}`) % 10n ** 44n).toString().padStart(44, '0');
}

export function buildDemoInvoice(kind: DemoDocumentKind, sessionId: string): IDemoInvoice {
  const base = DEMO_SCENARIO[kind];
  return {
    ...base,
    supplier: { ...base.supplier },
    products: base.products.map((item) => ({ ...item })),
    accessKey: deriveDemoAccessKey(sessionId, kind),
  };
}
