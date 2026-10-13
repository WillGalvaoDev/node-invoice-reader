// Gemini determinístico SOMENTE para o E2E local/CI (web/e2e/run.mjs).
//
// Não é um endpoint do serviço público: é um processo separado, iniciado pelo
// script de teste, para o qual o SDK é apontado via GOOGLE_GEMINI_BASE_URL. O
// backend roda o código de produção (GeminiAiProvider, guard, ledger) sem
// modificação; só o transporte HTTP muda de destino.
import { createServer } from 'node:http';
import { extractText, getDocumentProxy } from 'unpdf';

const SCENARIO = {
  initial: {
    invoiceNumber: '1', series: '999', issuedAt: '2026-10-10', totalValue: 20,
    supplier: { cnpj: '11222333000181', name: 'Fornecedor Sintetico DocScan' },
    products: [
      { code: 'CAN-A', description: 'Caneta esferografica azul', quantity: 10, unitMeasurement: 'UN', unitPrice: 2, totalPrice: 20 },
    ],
  },
  followup: {
    invoiceNumber: '2', series: '999', issuedAt: '2026-10-10', totalValue: 25,
    supplier: { cnpj: '11222333000181', name: 'Fornecedor Sintetico DocScan' },
    products: [
      { code: 'CAN-A', description: 'Caneta esferografica azul', quantity: 2, unitMeasurement: 'UN', unitPrice: 2, totalPrice: 4 },
      { code: 'CAD-A', description: 'Caderno capa dura', quantity: 1, unitMeasurement: 'UN', unitPrice: 15, totalPrice: 15 },
      { code: 'CAN-B', description: 'Caneta esferografica azul', quantity: 3, unitMeasurement: 'UN', unitPrice: 2, totalPrice: 6 },
    ],
  },
};

const state = { mode: 'ok', calls: { extraction: 0, similarity: 0 } };

function reply(response, status, body) {
  response.writeHead(status, { 'content-type': 'application/json' });
  response.end(JSON.stringify(body));
}

function textResponse(value) {
  return {
    candidates: [{ content: { role: 'model', parts: [{ text: JSON.stringify(value) }] }, finishReason: 'STOP', index: 0 }],
    usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 20, totalTokenCount: 120 },
    modelVersion: 'fake-gemini-e2e',
  };
}

async function extraction(parts) {
  const inline = parts.find((part) => part.inlineData)?.inlineData?.data;
  if (!inline) return {};
  const document = await getDocumentProxy(new Uint8Array(Buffer.from(inline, 'base64')));
  const { text } = await extractText(document, { mergePages: true });
  const accessKey = /\d{44}/.exec(text.replace(/\s+/g, ''))?.[0];
  if (!accessKey) return {};
  const kind = text.includes('CAD-A') ? 'followup' : 'initial';
  return { accessKey, ...SCENARIO[kind] };
}

function similarity(promptText) {
  const payload = JSON.parse(promptText.slice(promptText.indexOf('\n') + 1));
  const isPen = /caneta/i.test(payload.item.description);
  const candidate = isPen ? payload.candidates.find((item) => /caneta/i.test(item.description)) : undefined;
  return candidate
    ? { matchFound: true, matchedProductId: candidate.id, confidence: 0.95, reason: 'Mesma caneta esferografica azul com outro codigo.' }
    : { matchFound: false, matchedProductId: '', confidence: 0.1, reason: 'Produtos distintos.' };
}

const server = createServer((request, response) => {
  const chunks = [];
  request.on('data', (chunk) => chunks.push(chunk));
  request.on('end', async () => {
    try {
      const url = new URL(request.url ?? '/', 'http://localhost');
      if (request.method === 'POST' && url.pathname === '/__control') {
        Object.assign(state, JSON.parse(Buffer.concat(chunks).toString('utf8')));
        return reply(response, 200, { mode: state.mode });
      }
      if (request.method === 'GET' && url.pathname === '/__calls') return reply(response, 200, state.calls);
      if (request.method === 'POST' && url.pathname.endsWith(':generateContent')) {
        if (state.mode === 'rate_limit') {
          return reply(response, 429, { error: { code: 429, message: 'Resource exhausted (fake).', status: 'RESOURCE_EXHAUSTED' } });
        }
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        const parts = body.contents?.[0]?.parts ?? [];
        const first = parts[0]?.text ?? '';
        if (first.startsWith('UNTRUSTED_MATCHING_DATA')) {
          state.calls.similarity += 1;
          return reply(response, 200, textResponse(similarity(first)));
        }
        state.calls.extraction += 1;
        return reply(response, 200, textResponse(await extraction(parts)));
      }
      return reply(response, 404, { error: { code: 404, message: 'not found' } });
    } catch (error) {
      return reply(response, 500, { error: { code: 500, message: String(error) } });
    }
  });
});

const port = Number(process.env.FAKE_GEMINI_PORT ?? 0);
server.listen(port, '127.0.0.1', () => {
  // O orquestrador lê a porta da primeira linha.
  process.stdout.write(`${server.address().port}\n`);
});
