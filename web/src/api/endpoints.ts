import type { ApiClient } from './client';
import type {
  DemoSession,
  DocumentKind,
  PendingSuggestion,
  ProductPage,
  UploadResult,
} from './types';

const PAGE_SIZE = 50;

export function createEndpoints(client: ApiClient) {
  return {
    login: (email: string, password: string) =>
      client.postJson<{ token: string }>('/login', { email, password }, { authenticated: false }),

    register: (input: { name: string; email: string; password: string; inviteCode: string }) =>
      client.postJson<unknown>('/users', input, { authenticated: false }),

    changePassword: async (currentPassword: string, newPassword: string) => {
      // 401 aqui é, em geral, "senha atual incorreta" com token válido: não encerra a sessão local.
      await client.patchJson('/me/password', { currentPassword, newPassword }, { unauthorizedExpiresSession: false });
    },

    currentSession: () => client.get<{ session: DemoSession }>('/demo/sessions/current').then((data) => data.session),

    prepareSession: () => client.postJson<{ session: DemoSession }>('/demo/sessions', {}).then((data) => data.session),

    restartSession: (sessionId: string) =>
      client.postJson<{ session: DemoSession }>(`/demo/sessions/${sessionId}/restart`, {}).then((data) => data.session),

    downloadDocument: (sessionId: string, kind: DocumentKind) =>
      client.download(`/demo/sessions/${sessionId}/documents/${kind}`),

    uploadInvoice: (stockId: string, file: File) => {
      const form = new FormData();
      form.append('stockId', stockId);
      form.append('file', file);
      return client.postForm<UploadResult>('/invoices/upload', form);
    },

    listProducts: (stockId: string, cursor?: string) => {
      const query = new URLSearchParams({ stockId, limit: String(PAGE_SIZE) });
      if (cursor) query.set('cursor', cursor);
      return client.get<ProductPage>(`/products?${query.toString()}`);
    },

    listSuggestions: (stockId: string) =>
      client.get<{ suggestions: PendingSuggestion[] }>(`/stocks/${stockId}/suggestions`).then((data) => data.suggestions),

    confirmSuggestion: (suggestionId: string) =>
      client.postJson<unknown>(`/suggestions/${suggestionId}/confirm`, {}),

    rejectSuggestion: (suggestionId: string) =>
      client.postJson<unknown>(`/suggestions/${suggestionId}/reject`, {}),
  };
}

export type Endpoints = ReturnType<typeof createEndpoints>;
