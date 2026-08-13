import express from 'express';
import { unlink } from 'node:fs/promises';
import type { Server } from 'node:http';
import type { Request, Response } from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { errorHandler } from './middlewares/error-handler.js';

const uploadHandle = vi.hoisted(() => vi.fn());
vi.mock('./controllers/upload-invoice.controller.js', () => ({
  UploadInvoiceController: class { handle = uploadHandle; },
}));
vi.mock('./middlewares/ensure-authenticated.js', () => ({
  ensureAuthenticated: (_request: unknown, _response: unknown, next: () => void) => next(),
}));
vi.mock('./middlewares/upload-rate-limiter.js', () => ({
  uploadRateLimiter: (_request: unknown, _response: unknown, next: () => void) => next(),
}));
vi.mock('./config/env.js', () => ({
  env: { DATABASE_URL: 'postgresql://localhost/docscan', JWT_SECRET: 'secret', GEMINI_API_KEY: 'key', PORT: 3333 },
}));

const { routes } = await import('./routes.js');

describe('invoice upload HTTP', () => {
  let server: Server;
  let baseUrl: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    uploadHandle.mockImplementation(async (request: Request, response: Response) => {
      if (request.file) await unlink(request.file.path);
      return response.status(201).json({ mimeType: request.file?.mimetype });
    });
    const app = express();
    app.use(routes);
    app.use(errorHandler);
    await new Promise<void>((resolve, reject) => {
      server = app.listen(0, '127.0.0.1', (error?: Error) => error ? reject(error) : resolve());
    });
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('test server unavailable');
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  });

  async function upload(content: Uint8Array, type: string, name = 'danfe') {
    const form = new FormData();
    form.append('stockId', 'stock-1');
    const bytes = content.buffer.slice(content.byteOffset, content.byteOffset + content.byteLength) as ArrayBuffer;
    form.append('file', new Blob([bytes], { type }), name);
    return fetch(`${baseUrl}/invoices/upload`, { method: 'POST', body: form });
  }

  it('rejeita arquivo acima de 10 MiB com 413 antes do controller', async () => {
    const response = await upload(new Uint8Array(10 * 1024 * 1024 + 1), 'image/jpeg', 'large.jpg');

    expect(response.status).toBe(413);
    expect(uploadHandle).not.toHaveBeenCalled();
  });

  it('rejeita MIME nao suportado com 415 antes do controller', async () => {
    const response = await upload(new Uint8Array([1, 2, 3]), 'application/zip', 'invoice.zip');

    expect(response.status).toBe(415);
    expect(uploadHandle).not.toHaveBeenCalled();
  });

  it.each(['image/jpeg', 'image/png', 'application/pdf'])('preserva %s no arquivo entregue ao controller', async (mimeType) => {
    const response = await upload(new Uint8Array([1, 2, 3]), mimeType, 'extension-is-not-trusted.bin');

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ mimeType });
  });
});
