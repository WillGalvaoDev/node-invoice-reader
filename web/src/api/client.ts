export class ApiError extends Error {
  readonly status: number;
  readonly retryAfterSeconds: number | undefined;

  constructor(status: number, message: string, retryAfterSeconds?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/** A requisição não obteve resposta HTTP: o servidor pode ou não ter processado. */
export class NetworkError extends Error {
  constructor() {
    super('Sem resposta do servidor.');
    this.name = 'NetworkError';
  }
}

export interface RequestOptions {
  /** `false` em login/cadastro: um 401 ali é credencial inválida, não sessão expirada. */
  authenticated?: boolean;
  /**
   * `false` quando o 401 do endpoint também significa credencial inválida mesmo com
   * token válido (ex.: senha atual incorreta); o chamador decide se a sessão expirou.
   */
  unauthorizedExpiresSession?: boolean;
}

export interface DownloadedFile {
  blob: Blob;
  filename: string;
}

export interface ApiClient {
  get<T>(path: string, options?: RequestOptions): Promise<T>;
  postJson<T>(path: string, body: unknown, options?: RequestOptions): Promise<T>;
  postForm<T>(path: string, form: FormData, options?: RequestOptions): Promise<T>;
  /** Para respostas sem corpo (204), como a troca de senha. */
  patchJson(path: string, body: unknown, options?: RequestOptions): Promise<void>;
  download(path: string): Promise<DownloadedFile>;
}

interface CreateApiClientOptions {
  getToken: () => string | null;
  onUnauthorized: () => void;
  fetchImpl?: typeof fetch;
}

const GENERIC_MESSAGE = 'Não foi possível concluir a operação. Tente novamente.';

function parseRetryAfter(value: string | null): number | undefined {
  if (value === null || !/^\d+$/.test(value.trim())) return undefined;
  return Number(value);
}

export function createApiClient({ getToken, onUnauthorized, fetchImpl }: CreateApiClientOptions): ApiClient {
  async function send(
    path: string,
    init: RequestInit,
    authenticated: boolean,
    unauthorizedExpiresSession = true,
  ): Promise<Response> {
    const headers = new Headers(init.headers);
    const token = getToken();
    if (authenticated && token) headers.set('Authorization', `Bearer ${token}`);

    let response: Response;
    try {
      response = await (fetchImpl ?? fetch)(path, { ...init, headers });
    } catch {
      throw new NetworkError();
    }

    if (response.ok) return response;

    let message = GENERIC_MESSAGE;
    try {
      const body: unknown = await response.json();
      if (typeof body === 'object' && body !== null && 'message' in body && typeof body.message === 'string') {
        message = body.message;
      }
    } catch {
      // Corpo não JSON (proxy, HTML): mantém a mensagem genérica, sem exibir conteúdo bruto.
    }

    if (response.status === 401 && authenticated && unauthorizedExpiresSession) onUnauthorized();
    throw new ApiError(response.status, message, parseRetryAfter(response.headers.get('retry-after')));
  }

  async function envelope<T>(response: Response): Promise<T> {
    try {
      const body: unknown = await response.json();
      if (typeof body === 'object' && body !== null && 'data' in body) return body.data as T;
    } catch {
      // cai no erro abaixo
    }
    throw new ApiError(response.status, GENERIC_MESSAGE);
  }

  return {
    async get<T>(path: string, options: RequestOptions = {}) {
      return envelope<T>(await send(path, { method: 'GET' }, options.authenticated ?? true));
    },
    async postJson<T>(path: string, body: unknown, options: RequestOptions = {}) {
      const response = await send(
        path,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
        options.authenticated ?? true,
      );
      return envelope<T>(response);
    },
    async postForm<T>(path: string, form: FormData, options: RequestOptions = {}) {
      // Sem Content-Type manual: o navegador define o boundary do multipart.
      return envelope<T>(await send(path, { method: 'POST', body: form }, options.authenticated ?? true));
    },
    async patchJson(path: string, body: unknown, options: RequestOptions = {}) {
      await send(
        path,
        { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
        true,
        options.unauthorizedExpiresSession ?? true,
      );
    },
    async download(path: string) {
      const response = await send(path, { method: 'GET' }, true);
      const disposition = response.headers.get('content-disposition') ?? '';
      const filename = /filename="([^"]+)"/.exec(disposition)?.[1] ?? 'documento.pdf';
      return { blob: await response.blob(), filename };
    },
  };
}
