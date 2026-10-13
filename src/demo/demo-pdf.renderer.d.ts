import type { IDemoInvoice } from './demo-scenario.js';
/**
 * Renderiza o DANFE sintético de demonstração. Texto extraível (sem imagem),
 * somente fontes padrão do PDF e ASCII: o conteúdo é todo derivado do cenário
 * versionado, nunca de entrada do visitante.
 */
export declare function renderDemoDocument(invoice: IDemoInvoice): Promise<Buffer>;
//# sourceMappingURL=demo-pdf.renderer.d.ts.map