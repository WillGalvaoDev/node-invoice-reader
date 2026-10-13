import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { createApiClient } from '../api/client';
import { createEndpoints, type Endpoints } from '../api/endpoints';

interface AuthValue {
  api: Endpoints;
  isAuthenticated: boolean;
  /** Verdadeiro quando o servidor recusou o token (expirado/revogado) durante o uso. */
  sessionExpired: boolean;
  /** Aviso mostrado na tela de entrada após uma saída deliberada (ex.: troca de senha). */
  signOutNotice: string | null;
  signIn(email: string, password: string): Promise<void>;
  signOut(notice?: string): void;
}

const AuthContext = createContext<AuthValue | null>(null);

interface AuthProviderProps {
  children: ReactNode;
  /** Injetável para testes; em produção usa o `fetch` do navegador. */
  fetchImpl?: typeof fetch;
}

/** O JWT vive somente em memória: recarregar a página exige novo login e a sessão demo é reencontrada pela API. */
export function AuthProvider({ children, fetchImpl }: AuthProviderProps) {
  const tokenRef = useRef<string | null>(null);
  const [isAuthenticated, setAuthenticated] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [signOutNotice, setSignOutNotice] = useState<string | null>(null);

  const api = useMemo(() => createEndpoints(createApiClient({
    getToken: () => tokenRef.current,
    onUnauthorized: () => {
      tokenRef.current = null;
      setAuthenticated(false);
      setSessionExpired(true);
    },
    ...(fetchImpl && { fetchImpl }),
  })), [fetchImpl]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { token } = await api.login(email, password);
    tokenRef.current = token;
    setSessionExpired(false);
    setSignOutNotice(null);
    setAuthenticated(true);
  }, [api]);

  const signOut = useCallback((notice?: string) => {
    tokenRef.current = null;
    setAuthenticated(false);
    setSessionExpired(false);
    setSignOutNotice(notice ?? null);
  }, []);

  const value = useMemo<AuthValue>(
    () => ({ api, isAuthenticated, sessionExpired, signOutNotice, signIn, signOut }),
    [api, isAuthenticated, sessionExpired, signOutNotice, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth deve ser usado dentro de AuthProvider.');
  return value;
}
