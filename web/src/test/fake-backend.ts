import type { DemoSession, PendingSuggestion, Product } from '../api/types';

type Handler = (request: { method: string; path: string; headers: Headers; body: unknown; form: FormData | null }) => Response | Promise<Response>;

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
const ok = (data: unknown, status = 200) => json(status, { status: 'success', data });
const error = (status: number, message: string, headers: Record<string, string> = {}) =>
  json(status, { status: 'error', message }, headers);

export interface FakeBackend {
  fetch: typeof fetch;
  /** Todas as chamadas feitas, na ordem. */
  calls: Array<{ method: string; path: string; authorization: string | null }>;
  state: {
    session: DemoSession | null;
    products: Product[];
    suggestions: PendingSuggestion[];
    token: string;
    validToken: boolean;
    pageSize: number;
  };
  /** Falhas programadas para o próximo upload/decisão. */
  failNext: { upload?: Response; decision?: Response; networkOnUpload?: boolean; networkAfterRestart?: boolean };
  /** Quando definida, o upload só responde depois que a promessa resolver. */
  holdUpload: Promise<void> | null;
  setCurrentSessionMissing(): void;
}

export const PASSWORD = 'senha-correta-123';

let sequence = 0;
const id = (prefix: string) => `${prefix}-${++sequence}`;

export function createFakeBackend(): FakeBackend {
  const backend: FakeBackend = {
    fetch: undefined as unknown as typeof fetch,
    calls: [],
    state: { session: null, products: [], suggestions: [], token: 'jwt-do-teste', validToken: true, pageSize: 50 },
    failNext: {},
    holdUpload: null,
    setCurrentSessionMissing() { backend.state.session = null; },
  };

  const newSession = (): DemoSession => {
    const sessionId = id('session');
    return {
      id: sessionId, companyId: id('company'), stockId: id('stock'), state: 'ACTIVE',
      createdAt: '2026-10-10T12:00:00.000Z',
      documents: [
        { kind: 'initial', filename: 'demo-inicial.pdf', url: `/demo/sessions/${sessionId}/documents/initial` },
        { kind: 'followup', filename: 'demo-completa.pdf', url: `/demo/sessions/${sessionId}/documents/followup` },
      ],
      expectedResults: {
        initial: { summary: 'Uma extração por IA; CAN-A entra com 10 unidades.', products: [{ code: 'CAN-A', quantity: 10 }] },
        followup: { summary: 'CAN-A soma 2, CAD-A nasce com 1 e CAN-B vira sugestão.', products: [{ code: 'CAN-A', quantity: 2 }, { code: 'CAD-A', quantity: 1 }, { code: 'CAN-B', quantity: 3 }] },
      },
    };
  };

  const product = (code: string, description: string, quantity: number, unitPrice: number): Product => ({
    id: id('product'), code, description, quantity, unitMeasurement: 'UN', unitPrice,
    totalPrice: quantity * unitPrice, sourceSupplierCnpj: '11222333000181',
  });

  const upload: Handler = ({ form }) => {
    if (backend.failNext.networkOnUpload) {
      backend.failNext.networkOnUpload = false;
      throw new TypeError('Failed to fetch');
    }
    if (backend.failNext.upload) {
      const response = backend.failNext.upload;
      delete backend.failNext.upload;
      return response;
    }
    const file = form?.get('file');
    const name = file instanceof File ? file.name : '';
    const session = backend.state.session!;
    if (name.includes('inicial')) {
      const created = product('CAN-A', 'Caneta esferografica azul', 10, 2);
      backend.state.products = [created];
      return ok({ invoice: { invoiceNumber: '1', supplier: { cnpj: '11222333000181', name: 'Fornecedor Sintetico DocScan' } }, processedProducts: [created], suggestions: [] }, 201);
    }
    if (name.includes('completa')) {
      const pen = backend.state.products.find((item) => item.code === 'CAN-A')!;
      pen.quantity += 2;
      const notebook = product('CAD-A', 'Caderno capa dura', 1, 15);
      backend.state.products.push(notebook);
      const suggestion: PendingSuggestion = {
        id: id('suggestion'), stockId: session.stockId, suggestedProductId: pen.id, receivedCode: 'CAN-B',
        receivedDescription: '<img src=x onerror=alert(1)> Caneta esferografica azul', receivedQuantity: 3,
        receivedUnitPrice: 2, unitMeasurement: 'UN', receivedSupplierCnpj: '11222333000181',
        confidence: 0.95, reason: 'Mesma caneta, código diferente.', status: 'PENDING',
      };
      backend.state.suggestions.push(suggestion);
      return ok({
        invoice: { invoiceNumber: '2', supplier: { cnpj: '11222333000181', name: 'Fornecedor Sintetico DocScan' } },
        processedProducts: [pen, notebook],
        suggestions: [{
          id: suggestion.id, status: 'PENDING',
          invoiceItem: { code: 'CAN-B', description: suggestion.receivedDescription, quantity: 3, unitMeasurement: 'UN', unitPrice: 2, totalPrice: 6 },
          suggestedProduct: pen, confidence: 0.95, reason: suggestion.reason,
        }],
      }, 201);
    }
    return error(415, 'Tipo de arquivo não suportado.');
  };

  const decide = (kind: 'confirm' | 'reject'): Handler => ({ path }) => {
    if (backend.failNext.decision) {
      const response = backend.failNext.decision;
      delete backend.failNext.decision;
      return response;
    }
    const suggestionId = path.split('/')[2];
    const suggestion = backend.state.suggestions.find((item) => item.id === suggestionId);
    if (!suggestion || suggestion.status !== 'PENDING') return error(409, 'Sugestão já decidida.');
    suggestion.status = kind === 'confirm' ? 'CONFIRMED' : 'REJECTED';
    backend.state.suggestions = backend.state.suggestions.filter((item) => item.status === 'PENDING');
    if (kind === 'confirm') {
      const target = backend.state.products.find((item) => item.id === suggestion.suggestedProductId)!;
      target.quantity += suggestion.receivedQuantity;
    } else {
      backend.state.products.push(product(suggestion.receivedCode, suggestion.receivedDescription, suggestion.receivedQuantity, suggestion.receivedUnitPrice));
    }
    return ok({ suggestion });
  };

  backend.fetch = async (input, init = {}) => {
    const url = new URL(String(input), 'http://localhost');
    const method = (init.method ?? 'GET').toUpperCase();
    const headers = new Headers(init.headers);
    const path = url.pathname;
    backend.calls.push({ method, path: path + url.search, authorization: headers.get('authorization') });

    const body = typeof init.body === 'string' ? JSON.parse(init.body) as unknown : null;
    const form = init.body instanceof FormData ? init.body : null;

    if (method === 'POST' && path === '/login') {
      const credentials = body as { email: string; password: string };
      return credentials.password === PASSWORD ? ok({ token: backend.state.token }) : error(401, 'E-mail ou senha inválidos.');
    }
    if (method === 'POST' && path === '/users') {
      const input = body as { inviteCode?: string };
      return input.inviteCode === 'convite-valido' ? ok({ id: id('user') }, 201) : error(403, 'Cadastro não permitido.');
    }

    if (headers.get('authorization') !== `Bearer ${backend.state.token}` || !backend.state.validToken) {
      return error(401, 'Token inválido ou expirado.');
    }

    if (method === 'GET' && path === '/demo/sessions/current') {
      return backend.state.session ? ok({ session: backend.state.session }) : error(404, 'Nenhuma sessão de demonstração ativa.');
    }
    if (method === 'POST' && path === '/demo/sessions') {
      if (backend.state.session) return ok({ session: backend.state.session });
      backend.state.session = newSession();
      return ok({ session: backend.state.session }, 201);
    }
    if (method === 'POST' && /^\/demo\/sessions\/[^/]+\/restart$/.test(path)) {
      backend.state.session = newSession();
      backend.state.products = [];
      backend.state.suggestions = [];
      if (backend.failNext.networkAfterRestart) {
        // O servidor aplicou o reinício, mas a resposta se perdeu.
        backend.failNext.networkAfterRestart = false;
        throw new TypeError('Failed to fetch');
      }
      return ok({ session: backend.state.session });
    }
    if (method === 'GET' && /^\/demo\/sessions\/[^/]+\/documents\/(initial|followup)$/.test(path)) {
      const kind = path.endsWith('initial') ? 'demo-inicial.pdf' : 'demo-completa.pdf';
      return new Response('%PDF-1.4', { status: 200, headers: { 'content-type': 'application/pdf', 'content-disposition': `attachment; filename="${kind}"` } });
    }
    if (method === 'POST' && path === '/invoices/upload') {
      if (backend.holdUpload) await backend.holdUpload;
      return upload({ method, path, headers, body, form });
    }
    if (method === 'GET' && path === '/products') {
      const cursor = url.searchParams.get('cursor');
      const start = cursor ? Number(cursor) : 0;
      const items = backend.state.products.slice(start, start + backend.state.pageSize);
      const next = start + backend.state.pageSize;
      return ok({ items, nextCursor: next < backend.state.products.length ? String(next) : null });
    }
    if (method === 'GET' && /^\/stocks\/[^/]+\/suggestions$/.test(path)) {
      return ok({ suggestions: backend.state.suggestions });
    }
    if (method === 'POST' && /^\/suggestions\/[^/]+\/confirm$/.test(path)) return decide('confirm')({ method, path, headers, body, form });
    if (method === 'POST' && /^\/suggestions\/[^/]+\/reject$/.test(path)) return decide('reject')({ method, path, headers, body, form });
    if (method === 'PATCH' && path === '/me/password') {
      const input = body as { currentPassword: string };
      return input.currentPassword === PASSWORD ? new Response(null, { status: 204 }) : error(401, 'Senha atual incorreta.');
    }
    return error(404, 'Rota não encontrada.');
  };

  return backend;
}

export { error as errorResponse };
