import PDFDocument from 'pdfkit';
import type { IDemoInvoice } from './demo-scenario.js';

const NAVY = '#17324D';
const ZEBRA = '#EFF4F8';
const RULE = '#CDD8E2';
const MARGIN = 42;
// Mesmas larguras do gerador de referência (scripts/generate-demo-pdfs.py).
const COLUMNS = [
  { header: 'Codigo', width: 65, align: 'left' },
  { header: 'Descricao', width: 216, align: 'left' },
  { header: 'UN', width: 30, align: 'left' },
  { header: 'Qtd.', width: 40, align: 'right' },
  { header: 'Unitario R$', width: 80, align: 'right' },
  { header: 'Total R$', width: 80, align: 'right' },
] as const;
const CELL_PADDING = 8;

const money = (value: number) => value.toFixed(2).replace('.', ',');

/**
 * Renderiza o DANFE sintético de demonstração. Texto extraível (sem imagem),
 * somente fontes padrão do PDF e ASCII: o conteúdo é todo derivado do cenário
 * versionado, nunca de entrada do visitante.
 */
export function renderDemoDocument(invoice: IDemoInvoice): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const document = new PDFDocument({
      size: 'A4',
      margin: MARGIN,
      info: {
        Title: 'DocScan - documento sintetico sem valor fiscal',
        Author: 'DocScan',
        CreationDate: new Date(`${invoice.issuedAt}T00:00:00Z`),
      },
    });
    const chunks: Buffer[] = [];
    document.on('data', (chunk: Buffer) => chunks.push(chunk));
    document.on('end', () => resolve(Buffer.concat(chunks)));
    document.on('error', reject);

    try {
      draw(document, invoice);
      document.end();
    } catch (error) {
      reject(error);
    }
  });
}

function draw(document: PDFKit.PDFDocument, invoice: IDemoInvoice): void {
  const text = (value: string, size: number, font = 'Helvetica') =>
    document.font(font).fontSize(size).fillColor(NAVY).text(value, MARGIN, document.y, { width: 511 });

  text('DOCSCAN / DEMONSTRACAO', 8);
  document.moveDown(1.2);
  text('DANFE SINTETICO', 23, 'Helvetica-Bold');
  document.moveDown(0.5);
  text('SEM VALOR FISCAL - DADOS PARA TESTE', 10, 'Helvetica-Bold');
  text('Documento ficticio para demonstrar extracao e revisao de produtos. '
    + 'Nao representa uma operacao comercial nem uma NF-e autorizada.', 8);
  document.moveDown(1.8);
  text('EMITENTE SINTETICO', 10, 'Helvetica-Bold');
  text(invoice.supplier.name, 10);
  text(`CNPJ de teste: ${invoice.supplier.cnpj}`, 10);
  document.moveDown(1.2);
  text(`Numero: ${invoice.invoiceNumber}    Serie: ${invoice.series}    Emissao: ${invoice.issuedAt}`, 10);
  document.moveDown(1);
  text('CHAVE DE ACESSO SINTETICA (44 DIGITOS)', 8);
  text(invoice.accessKey, 10, 'Courier');
  document.moveDown(1.8);
  text('PRODUTOS', 10, 'Helvetica-Bold');
  document.moveDown(0.6);

  drawTable(document, invoice);

  document.moveDown(1.4);
  text(`VALOR TOTAL DO DOCUMENTO: R$ ${money(invoice.totalValue)}`, 10, 'Helvetica-Bold');
  document.moveDown(2);
  text('Uso exclusivo na demonstracao DocScan. Todos os dados deste documento sao sinteticos.', 8);
}

function drawTable(document: PDFKit.PDFDocument, invoice: IDemoInvoice): void {
  const tableWidth = COLUMNS.reduce((sum, column) => sum + column.width, 0);
  let y = document.y;

  const drawRow = (cells: string[], options: { header: boolean; shaded: boolean }) => {
    const font = options.header ? 'Helvetica-Bold' : 'Helvetica';
    document.font(font).fontSize(9);
    const textHeight = Math.max(...cells.map((cell, index) => document.heightOfString(cell, {
      width: COLUMNS[index]!.width - 2 * CELL_PADDING,
    })));
    const rowHeight = textHeight + 2 * CELL_PADDING;

    if (options.header) {
      document.rect(MARGIN, y, tableWidth, rowHeight).fill(NAVY);
    } else if (options.shaded) {
      document.rect(MARGIN, y, tableWidth, rowHeight).fill(ZEBRA);
    }

    let x = MARGIN;
    cells.forEach((cell, index) => {
      const column = COLUMNS[index]!;
      document.font(font).fontSize(9).fillColor(options.header ? '#FFFFFF' : NAVY).text(cell, x + CELL_PADDING, y + CELL_PADDING, {
        width: column.width - 2 * CELL_PADDING,
        align: column.align,
      });
      x += column.width;
    });
    y += rowHeight;
  };

  drawRow(COLUMNS.map((column) => column.header), { header: true, shaded: false });
  invoice.products.forEach((item, index) => {
    drawRow(
      [item.code, item.description, item.unitMeasurement, String(item.quantity), money(item.unitPrice), money(item.totalPrice)],
      { header: false, shaded: index % 2 === 0 },
    );
  });
  document.moveTo(MARGIN, y).lineTo(MARGIN + tableWidth, y).lineWidth(0.5).strokeColor(RULE).stroke();
  document.x = MARGIN;
  document.y = y;
}
