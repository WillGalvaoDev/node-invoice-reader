export declare const DEMO_DOCUMENT_KINDS: readonly ["initial", "followup"];
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
    supplier: {
        cnpj: string;
        name: string;
    };
    products: IDemoInvoiceItem[];
}
export declare const DEMO_DOCUMENT_FILENAMES: Record<DemoDocumentKind, string>;
/**
 * Espelho de examples/demo/scenario.json (verificado por teste). Embutido para o
 * serviço não depender de arquivos fora do artefato compilado.
 */
export declare const DEMO_SCENARIO: Record<DemoDocumentKind, IDemoInvoice>;
/** Mesmo algoritmo de scripts/generate-demo-pdfs.py: sha256(...) mod 10^44, 44 dígitos. */
export declare function deriveDemoAccessKey(sessionId: string, kind: DemoDocumentKind): string;
export declare function buildDemoInvoice(kind: DemoDocumentKind, sessionId: string): IDemoInvoice;
//# sourceMappingURL=demo-scenario.d.ts.map