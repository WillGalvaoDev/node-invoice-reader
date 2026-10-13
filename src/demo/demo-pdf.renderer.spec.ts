import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { extractText, getDocumentProxy } from 'unpdf';
import { buildDemoInvoice, DEMO_SCENARIO, type DemoDocumentKind } from './demo-scenario.js';
import { renderDemoDocument } from './demo-pdf.renderer.js';

async function readPdf(bytes: Uint8Array) {
  const document = await getDocumentProxy(new Uint8Array(bytes));
  const { totalPages, text } = await extractText(document, { mergePages: true });
  return { totalPages, text: text.replace(/\s+/g, ' ') };
}

const money = (value: number) => value.toFixed(2).replace('.', ',');

describe('renderDemoDocument', () => {
  it.each(['initial', 'followup'] as DemoDocumentKind[])('gera PDF legível de uma página com todos os dados de %s', async (kind) => {
    const invoice = buildDemoInvoice(kind, 'session-render');

    const bytes = await renderDemoDocument(invoice);
    const { totalPages, text } = await readPdf(bytes);

    expect(Buffer.from(bytes.subarray(0, 5)).toString('latin1')).toBe('%PDF-');
    expect(totalPages).toBe(1);
    expect(text).toContain('SEM VALOR FISCAL');
    expect(text).toContain('sao sinteticos');
    expect(text).toContain(invoice.accessKey);
    expect(text).toContain(invoice.supplier.cnpj);
    expect(text).toContain(`R$ ${money(invoice.totalValue)}`);
    for (const item of invoice.products) {
      expect(text).toContain(item.code);
      expect(text).toContain(item.description);
      expect(text).toContain(money(item.unitPrice));
      expect(text).toContain(money(item.totalPrice));
    }
  });

  it('contém os mesmos fatos do PDF oficial gerado pelo script Python (paridade)', async () => {
    for (const [kind, file] of [['initial', 'demo-inicial.pdf'], ['followup', 'demo-completa.pdf']] as const) {
      const official = await readPdf(await readFile(`output/pdf/${file}`));
      const rendered = await readPdf(await renderDemoDocument({ ...DEMO_SCENARIO[kind] }));
      const facts = [
        'SEM VALOR FISCAL', DEMO_SCENARIO[kind].accessKey, DEMO_SCENARIO[kind].supplier.cnpj,
        DEMO_SCENARIO[kind].supplier.name, `R$ ${money(DEMO_SCENARIO[kind].totalValue)}`,
        ...DEMO_SCENARIO[kind].products.flatMap((item) => [item.code, item.description]),
      ];
      for (const fact of facts) {
        expect(official.text, `oficial: ${fact}`).toContain(fact);
        expect(rendered.text, `renderizado: ${fact}`).toContain(fact);
      }
      expect(rendered.totalPages).toBe(official.totalPages);
    }
  });

  it('é determinístico no conteúdo textual para a mesma nota', async () => {
    const invoice = buildDemoInvoice('followup', 'same-session');
    const first = await readPdf(await renderDemoDocument(invoice));
    const second = await readPdf(await renderDemoDocument(invoice));
    expect(second.text).toBe(first.text);
  });
});
