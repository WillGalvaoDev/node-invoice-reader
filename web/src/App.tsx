import { useEffect } from 'react';
import { Link, useRoute } from './router';
import { useAuth } from './state/auth';
import { AccountPage, AuthPage, JourneyPage, LandingPage } from './pages';

export function App() {
  const { route, navigate } = useRoute();
  const { isAuthenticated, signOut } = useAuth();
  const needsAuth = route === '/demo' || route === '/conta';

  // Rota protegida sem sessão: leva à entrada (inclusive quando o token expirou durante o uso).
  useEffect(() => {
    if (needsAuth && !isAuthenticated) navigate('/entrar', { replace: true });
  }, [needsAuth, isAuthenticated, navigate]);

  let page;
  if (needsAuth && !isAuthenticated) page = null;
  else if (route === '/entrar') page = <AuthPage mode="login" navigate={navigate} />;
  else if (route === '/cadastro') page = <AuthPage mode="register" navigate={navigate} />;
  else if (route === '/demo') page = <JourneyPage />;
  else if (route === '/conta') page = <AccountPage />;
  else page = <LandingPage navigate={navigate} />;

  return (
    <>
      <a className="skip-link" href="#conteudo">Ir para o conteúdo</a>
      <header className="site-header">
        <Link to="/" navigate={navigate} className="brand">DocScan</Link>
        <nav aria-label="Principal">
          {isAuthenticated ? (
            <>
              <Link to="/demo" navigate={navigate}>Demonstração</Link>
              <Link to="/conta" navigate={navigate}>Conta</Link>
              <button
                type="button"
                className="link-button"
                onClick={() => { signOut(); navigate('/'); }}
              >
                Sair
              </button>
            </>
          ) : (
            <>
              <Link to="/entrar" navigate={navigate}>Entrar</Link>
              <Link to="/cadastro" navigate={navigate}>Criar conta</Link>
            </>
          )}
        </nav>
      </header>
      <main id="conteudo" tabIndex={-1}>
        {page}
      </main>
      <footer className="site-footer">
        <p>Demonstração técnica com dados sintéticos, sem valor fiscal. Disponibilidade sujeita ao provedor de IA.</p>
      </footer>
    </>
  );
}
