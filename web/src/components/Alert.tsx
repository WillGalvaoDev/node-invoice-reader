import { useEffect, useRef, type ReactNode } from 'react';

interface AlertProps {
  tone: 'error' | 'info' | 'success';
  children: ReactNode;
  /** Move o foco para o aviso (erros após uma ação), para leitores de tela e teclado. */
  focusOnMount?: boolean;
}

export function Alert({ tone, children, focusOnMount = false }: AlertProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (focusOnMount) ref.current?.focus();
  }, [focusOnMount]);

  return (
    <div
      ref={ref}
      className={`alert alert-${tone}`}
      role={tone === 'error' ? 'alert' : 'status'}
      tabIndex={-1}
    >
      {children}
    </div>
  );
}
