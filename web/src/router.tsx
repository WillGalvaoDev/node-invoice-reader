import { useCallback, useEffect, useState, type MouseEvent, type ReactNode } from 'react';

export const BASE_PATH = '/app';

export type RoutePath = '/' | '/entrar' | '/cadastro' | '/demo' | '/conta';

const KNOWN: readonly RoutePath[] = ['/', '/entrar', '/cadastro', '/demo', '/conta'];

/** Converte `location.pathname` em rota da interface; desconhecida cai na apresentação. */
export function toRoute(pathname: string): RoutePath {
  const relative = pathname.startsWith(BASE_PATH) ? pathname.slice(BASE_PATH.length) : pathname;
  const normalized = relative === '' ? '/' : relative.replace(/\/+$/, '') || '/';
  return KNOWN.find((route) => route === normalized) ?? '/';
}

export function useRoute() {
  const [route, setRoute] = useState<RoutePath>(() => toRoute(window.location.pathname));

  useEffect(() => {
    const onPopState = () => setRoute(toRoute(window.location.pathname));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = useCallback((to: RoutePath, options: { replace?: boolean } = {}) => {
    const target = to === '/' ? `${BASE_PATH}/` : `${BASE_PATH}${to}`;
    if (options.replace) window.history.replaceState(null, '', target);
    else window.history.pushState(null, '', target);
    setRoute(to);
  }, []);

  return { route, navigate };
}

interface LinkProps {
  to: RoutePath;
  navigate: (to: RoutePath) => void;
  children: ReactNode;
  className?: string;
}

/** Âncora real (funciona com clique do meio e sem JS); intercepta apenas o clique simples. */
export function Link({ to, navigate, children, className }: LinkProps) {
  const href = to === '/' ? `${BASE_PATH}/` : `${BASE_PATH}${to}`;
  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigate(to);
  };
  return <a href={href} onClick={onClick} {...(className && { className })}>{children}</a>;
}
