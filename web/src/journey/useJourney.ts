import { useCallback, useEffect, useRef, useState } from 'react';
import type { Endpoints } from '../api/endpoints';
import { ApiError } from '../api/client';
import { describeFailure, type Failure, type FailureContext } from '../api/failure';
import type { DemoSession, DocumentKind, PendingSuggestion, Product, UploadResult } from '../api/types';

export type Busy = 'preparing' | 'restarting' | 'uploading' | 'deciding' | 'refreshing' | null;

export interface JourneyState {
  /** `undefined` enquanto a primeira consulta não terminou; `null` quando não há sessão ativa. */
  session: DemoSession | null | undefined;
  products: Product[];
  hasMoreProducts: boolean;
  suggestions: PendingSuggestion[];
  lastUpload: UploadResult | null;
  failure: Failure | null;
  failureId: number;
  notice: string | null;
  busy: Busy;
  decidingId: string | null;
}

const initialState: JourneyState = {
  session: undefined, products: [], hasMoreProducts: false, suggestions: [],
  lastUpload: null, failure: null, failureId: 0, notice: null, busy: null, decidingId: null,
};

/**
 * Orquestra a jornada. Regras: uma operação mutável por vez; nenhum retry automático;
 * após qualquer falha que possa ter alterado o estado, o estado é relido do servidor.
 */
export function useJourney(api: Endpoints) {
  const [state, setState] = useState<JourneyState>(initialState);
  const nextCursor = useRef<string | null>(null);
  const mounted = useRef(true);
  const inFlight = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const patch = useCallback((changes: Partial<JourneyState>) => {
    if (mounted.current) setState((current) => ({ ...current, ...changes }));
  }, []);

  const fail = useCallback((error: unknown, context: FailureContext) => {
    const failure = describeFailure(error, context);
    setState((current) => ({ ...current, failure, failureId: current.failureId + 1, busy: null, decidingId: null }));
    return failure;
  }, []);

  const loadStock = useCallback(async (session: DemoSession) => {
    const [page, suggestions] = await Promise.all([
      api.listProducts(session.stockId),
      api.listSuggestions(session.stockId),
    ]);
    nextCursor.current = page.nextCursor;
    patch({ products: page.items, hasMoreProducts: page.nextCursor !== null, suggestions });
  }, [api, patch]);

  const refresh = useCallback(async (session: DemoSession) => {
    try {
      await loadStock(session);
    } catch (error) {
      fail(error, 'general');
    }
  }, [loadStock, fail]);

  /** Primeira carga: reencontra a sessão ativa e o estado persistido. */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const session = await api.currentSession();
        if (cancelled) return;
        patch({ session });
        await loadStock(session);
      } catch (error) {
        if (cancelled) return;
        if (error instanceof ApiError && error.status === 404) {
          patch({ session: null });
          return;
        }
        patch({ session: null });
        fail(error, 'general');
      }
    })();
    return () => { cancelled = true; };
  }, [api, loadStock, patch, fail]);

  /** Garante uma operação mutável por vez, mesmo com cliques rápidos. */
  const exclusive = useCallback(async <T,>(busy: Exclude<Busy, null>, action: () => Promise<T>): Promise<T | undefined> => {
    if (inFlight.current) return undefined;
    inFlight.current = true;
    patch({ busy, failure: null, notice: null });
    try {
      return await action();
    } finally {
      inFlight.current = false;
      patch({ busy: null, decidingId: null });
    }
  }, [patch]);

  /** Após falha de estado desconhecido (rede), descobre qual ambiente está de fato ativo. */
  const resyncSession = useCallback(async () => {
    try {
      const session = await api.currentSession();
      patch({ session, lastUpload: null });
      await loadStock(session);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) patch({ session: null, products: [], suggestions: [] });
    }
  }, [api, loadStock, patch]);

  const prepare = useCallback(() => exclusive('preparing', async () => {
    try {
      const session = await api.prepareSession();
      patch({ session, products: [], suggestions: [], lastUpload: null, hasMoreProducts: false });
      await loadStock(session);
    } catch (error) {
      const failure = fail(error, 'general');
      if (failure.reload) await resyncSession();
    }
  }), [api, exclusive, loadStock, resyncSession, patch, fail]);

  const restart = useCallback((sessionId: string) => exclusive('restarting', async () => {
    try {
      const session = await api.restartSession(sessionId);
      patch({
        session, products: [], suggestions: [], lastUpload: null, hasMoreProducts: false,
        notice: 'Ambiente reiniciado. O anterior foi arquivado e o novo está vazio.',
      });
      await loadStock(session);
    } catch (error) {
      const failure = fail(error, 'general');
      // Reinício interrompido pode ter sido aplicado: relê o ambiente ativo em vez de supor.
      if (failure.reload) await resyncSession();
    }
  }), [api, exclusive, loadStock, resyncSession, patch, fail]);

  /** Resolve `true` somente quando a nota foi processada; falha mantém o arquivo para nova tentativa manual. */
  const upload = useCallback(async (session: DemoSession, file: File): Promise<boolean> => {
    const processed = await exclusive('uploading', async () => {
      try {
        const result = await api.uploadInvoice(session.stockId, file);
        patch({
          lastUpload: result,
          notice: result.suggestions.length > 0
            ? 'Nota processada. Há sugestões aguardando a sua decisão; elas ainda não alteraram o estoque.'
            : 'Nota processada e aplicada ao estoque.',
        });
        await loadStock(session);
        return true;
      } catch (error) {
        const failure = fail(error, 'upload');
        // Estado possivelmente alterado ou nota já conhecida: consulta o servidor, sem reenviar.
        if (failure.reload) await refresh(session);
        return false;
      }
    });
    return processed === true;
  }, [api, exclusive, loadStock, refresh, patch, fail]);

  const decide = useCallback((session: DemoSession, suggestionId: string, decision: 'confirm' | 'reject') =>
    exclusive('deciding', async () => {
      patch({ decidingId: suggestionId });
      try {
        if (decision === 'confirm') await api.confirmSuggestion(suggestionId);
        else await api.rejectSuggestion(suggestionId);
        patch({
          lastUpload: null,
          notice: decision === 'confirm'
            ? 'Sugestão confirmada: a quantidade foi somada ao produto sugerido.'
            : 'Sugestão rejeitada: o item foi cadastrado como produto novo.',
        });
        await loadStock(session);
      } catch (error) {
        const failure = fail(error, 'decision');
        if (failure.reload) await refresh(session);
      }
    }), [api, exclusive, loadStock, refresh, patch, fail]);

  const loadMoreProducts = useCallback(async (session: DemoSession) => {
    const cursor = nextCursor.current;
    if (!cursor) return;
    try {
      const page = await api.listProducts(session.stockId, cursor);
      nextCursor.current = page.nextCursor;
      setState((current) => ({
        ...current,
        products: [...current.products, ...page.items],
        hasMoreProducts: page.nextCursor !== null,
      }));
    } catch (error) {
      fail(error, 'general');
    }
  }, [api, fail]);

  const downloadDocument = useCallback(async (session: DemoSession, kind: DocumentKind) => {
    try {
      const { blob, filename } = await api.downloadDocument(session.id, kind);
      const url = URL.createObjectURL(blob);
      try {
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = filename;
        document.body.append(anchor);
        anchor.click();
        anchor.remove();
      } finally {
        // Libera o objeto do navegador assim que o download foi disparado.
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      fail(error, 'general');
    }
  }, [api, fail]);

  const reload = useCallback(async () => {
    if (!state.session) return;
    patch({ busy: 'refreshing', failure: null });
    await refresh(state.session);
    patch({ busy: null });
  }, [state.session, refresh, patch]);

  return { state, prepare, restart, upload, decide, loadMoreProducts, downloadDocument, reload };
}
