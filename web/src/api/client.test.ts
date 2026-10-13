import { describe, expect, it, vi } from 'vitest';
import { ApiError, NetworkError, createApiClient } from './client';

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' }, ...init });

function setup(token: string | null = 'secret-token') {
  const fetchImpl = vi.fn<typeof fetch>();
  const onUnauthorized = vi.fn();
  const client = createApiClient({ getToken: () => token, onUnauthorized, fetchImpl });
  return { fetchImpl, onUnauthorized, client };
}

describe('createApiClient', () => {
  it('envia Bearer no cabeçalho (nunca na URL) e devolve data do envelope', async () => {
    const { client, fetchImpl } = setup();
    fetchImpl.mockImplementation(async () => json({ status: 'success', data: { items: [1] } }));

    const data = await client.get<{ items: number[] }>('/products?stockId=abc');

    expect(data).toEqual({ items: [1] });
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(String(url)).toBe('/products?stockId=abc');
    expect(String(url)).not.toContain('secret-token');
    expect(new Headers(init?.headers).get('authorization')).toBe('Bearer secret-token');
  });

  it('postJson serializa o corpo e declara JSON; postForm não fixa Content-Type', async () => {
    const { client, fetchImpl } = setup();
    fetchImpl.mockImplementation(async () => json({ status: 'success', data: {} }));

    await client.postJson('/demo/sessions', {});
    const form = new FormData();
    form.append('stockId', 'x');
    await client.postForm('/invoices/upload', form);

    const jsonInit = fetchImpl.mock.calls[0]![1]!;
    expect(jsonInit.method).toBe('POST');
    expect(jsonInit.body).toBe('{}');
    expect(new Headers(jsonInit.headers).get('content-type')).toBe('application/json');
    const formInit = fetchImpl.mock.calls[1]![1]!;
    expect(formInit.body).toBe(form);
    expect(new Headers(formInit.headers).has('content-type')).toBe(false);
  });

  it('401 autenticado encerra a sessão local; 401 de login não', async () => {
    const { client, fetchImpl, onUnauthorized } = setup();
    fetchImpl.mockImplementation(async () => json({ status: 'error', message: 'Token inválido.' }, { status: 401 }));

    await expect(client.get('/companies')).rejects.toMatchObject({ status: 401 });
    expect(onUnauthorized).toHaveBeenCalledTimes(1);

    await expect(client.postJson('/login', { email: 'a', password: 'b' }, { authenticated: false }))
      .rejects.toMatchObject({ status: 401, message: 'Token inválido.' });
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('expõe mensagem do envelope e Retry-After numérico somente quando válido', async () => {
    const { client, fetchImpl } = setup();
    fetchImpl.mockResolvedValueOnce(json({ status: 'error', message: 'Limite atingido.' }, { status: 429, headers: { 'retry-after': '37', 'content-type': 'application/json' } }));
    const limited = await client.get('/x').catch((e: unknown) => e) as ApiError;
    expect(limited).toBeInstanceOf(ApiError);
    expect([limited.status, limited.message, limited.retryAfterSeconds]).toEqual([429, 'Limite atingido.', 37]);

    fetchImpl.mockResolvedValueOnce(json({ status: 'error', message: 'Limite atingido.' }, { status: 429, headers: { 'retry-after': 'amanhã', 'content-type': 'application/json' } }));
    const invalid = await client.get('/x').catch((e: unknown) => e) as ApiError;
    expect(invalid.retryAfterSeconds).toBeUndefined();
  });

  it('resposta que não é o envelope vira ApiError genérico preservando o status', async () => {
    const { client, fetchImpl } = setup();
    fetchImpl.mockResolvedValue(new Response('<html>Bad Gateway</html>', { status: 502, headers: { 'content-type': 'text/html' } }));

    const error = await client.get('/x').catch((e: unknown) => e) as ApiError;

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(502);
    expect(error.message).not.toContain('<html>');
  });

  it('falha de rede é NetworkError, distinta de resposta HTTP', async () => {
    const { client, fetchImpl } = setup();
    fetchImpl.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(client.get('/x')).rejects.toBeInstanceOf(NetworkError);
  });

  it('patchJson aceita 204 sem corpo e propaga erro de negócio', async () => {
    const { client, fetchImpl, onUnauthorized } = setup();
    fetchImpl.mockImplementationOnce(async () => new Response(null, { status: 204 }));
    await expect(client.patchJson('/me/password', { currentPassword: 'a', newPassword: 'b' })).resolves.toBeUndefined();
    expect(fetchImpl.mock.calls[0]![1]!.method).toBe('PATCH');

    fetchImpl.mockImplementationOnce(async () => json({ status: 'error', message: 'Senha atual incorreta.' }, { status: 401 }));
    await expect(client.patchJson('/me/password', {}, { unauthorizedExpiresSession: false })).rejects.toMatchObject({ status: 401 });
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('download devolve o Blob e o nome do arquivo do cabeçalho', async () => {
    const { client, fetchImpl } = setup();
    fetchImpl.mockResolvedValue(new Response('%PDF-1.4', {
      status: 200,
      headers: { 'content-type': 'application/pdf', 'content-disposition': 'attachment; filename="demo-inicial.pdf"' },
    }));

    const file = await client.download('/demo/sessions/s/documents/initial');

    expect(file.filename).toBe('demo-inicial.pdf');
    expect(file.blob.type).toBe('application/pdf');
    expect(await file.blob.text()).toBe('%PDF-1.4');
  });
});
