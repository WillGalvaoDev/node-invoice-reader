import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Alert } from './components/Alert';
import { describeFailure, type Failure } from './api/failure';
import { useAuth } from './state/auth';
import { Link, type RoutePath } from './router';
import { useJourney } from './journey/useJourney';
import { ReviewPanel, SessionPanel, StockPanel, UploadPanel } from './journey/panels';

interface NavProps {
  navigate: (to: RoutePath) => void;
}

export function LandingPage({ navigate }: NavProps) {
  const { isAuthenticated } = useAuth();

  return (
    <section className="card">
      <h1>DocScan — leitura inteligente de notas fiscais</h1>
      <p>
        Esta é uma demonstração técnica de um backend que lê um DANFE com IA, valida o resultado de forma
        determinística e deixa as decisões que mudam a identidade de produtos para uma pessoa revisar.
      </p>
      <ol>
        <li><strong>Extração:</strong> a IA lê o documento e sugere os dados.</li>
        <li><strong>Validação:</strong> regras fixas conferem totais, itens, fornecedor e unidade.</li>
        <li><strong>Revisão humana:</strong> semelhanças encontradas pela IA viram sugestões que você confirma ou rejeita.</li>
      </ol>
      <p>
        Todos os documentos são <strong>dados sintéticos, sem valor fiscal</strong>. A disponibilidade depende do
        provedor de IA e pode variar: se o serviço recusar uma chamada, nada é alterado e você pode tentar
        novamente mais tarde.
      </p>
      <p>O acesso é por convite, com conta individual. O convite é fornecido pelo responsável pela demonstração.</p>
      <div className="actions">
        {isAuthenticated ? (
          <Link to="/demo" navigate={navigate} className="button primary">Ir para a demonstração</Link>
        ) : (
          <>
            <Link to="/entrar" navigate={navigate} className="button primary">Entrar</Link>
            <Link to="/cadastro" navigate={navigate} className="button">Criar conta</Link>
          </>
        )}
      </div>
    </section>
  );
}

interface AuthPageProps extends NavProps {
  mode: 'login' | 'register';
}

export function AuthPage({ mode, navigate }: AuthPageProps) {
  const { api, signIn, sessionExpired, signOutNotice } = useAuth();
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [failureCount, setFailureCount] = useState(0);
  const submitting = useRef(false);
  const isRegister = mode === 'register';

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') ?? '');
    const password = String(form.get('password') ?? '');
    setPending(true);
    setFailure(null);
    try {
      if (isRegister) {
        await api.register({
          name: String(form.get('name') ?? ''),
          email,
          password,
          inviteCode: String(form.get('inviteCode') ?? ''),
        });
      }
      await signIn(email, password);
      navigate('/demo');
    } catch (error) {
      const described = describeFailure(error, 'general');
      // Em login/cadastro o servidor devolve mensagens deliberadamente genéricas; exibe-as.
      const message = error instanceof Error && 'status' in error && error.message ? error.message : described.message;
      setFailure({ ...described, message });
      setFailureCount((count) => count + 1);
    } finally {
      submitting.current = false;
      setPending(false);
    }
  };

  return (
    <section className="card narrow">
      <h1>{isRegister ? 'Criar conta' : 'Entrar'}</h1>
      {(sessionExpired || signOutNotice) && !failure && (
        <Alert tone="info">{signOutNotice ?? 'Sua sessão expirou. Entre novamente para continuar.'}</Alert>
      )}
      {failure && <Alert key={failureCount} tone="error" focusOnMount>{failure.message}</Alert>}
      <form onSubmit={(event) => void submit(event)}>
        {isRegister && (
          <>
            <label htmlFor="name">Nome</label>
            <input id="name" name="name" type="text" autoComplete="name" required minLength={2} maxLength={120} />
          </>
        )}
        <label htmlFor="email">E-mail</label>
        <input id="email" name="email" type="email" autoComplete="email" required maxLength={254} />
        <label htmlFor="password">Senha</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete={isRegister ? 'new-password' : 'current-password'}
          required
          minLength={8}
          maxLength={128}
        />
        {isRegister && (
          <>
            <label htmlFor="inviteCode">Código de convite</label>
            <input id="inviteCode" name="inviteCode" type="text" autoComplete="off" required maxLength={200} />
            <p className="hint">O convite é fornecido pelo responsável pela demonstração.</p>
          </>
        )}
        <button type="submit" className="primary" disabled={pending}>
          {pending ? 'Aguarde…' : isRegister ? 'Criar conta' : 'Entrar'}
        </button>
      </form>
      <p>
        {isRegister ? (
          <>Já tem conta? <Link to="/entrar" navigate={navigate}>Entrar</Link></>
        ) : (
          <>Ainda não tem conta? <Link to="/cadastro" navigate={navigate}>Criar conta</Link></>
        )}
      </p>
    </section>
  );
}

export function JourneyPage() {
  const { api } = useAuth();
  const journey = useJourney(api);
  const { state } = journey;
  const session = state.session ?? null;
  const busy = state.busy !== null;

  return (
    <>
      <h1>Demonstração</h1>
      <p aria-live="polite" className="sr-only">
        {state.busy === 'uploading' ? 'Processando a nota.' : ''}
      </p>
      {state.notice && <Alert tone="success">{state.notice}</Alert>}
      {state.failure && (
        <Alert key={state.failureId} tone="error" focusOnMount>
          {state.failure.message}
        </Alert>
      )}
      <SessionPanel
        session={state.session}
        busy={busy}
        restarting={state.busy === 'restarting'}
        onPrepare={() => void journey.prepare()}
        onRestart={(sessionId) => void journey.restart(sessionId)}
        onDownload={(kind) => session && void journey.downloadDocument(session, kind)}
      />
      {session && (
        <>
          <UploadPanel
            disabled={busy}
            uploading={state.busy === 'uploading'}
            lastUpload={state.lastUpload}
            onUpload={(file) => journey.upload(session, file)}
          />
          <ReviewPanel
            suggestions={state.suggestions}
            products={state.products}
            busy={busy}
            decidingId={state.decidingId}
            onDecide={(id, decision) => void journey.decide(session, id, decision)}
          />
          <StockPanel
            products={state.products}
            hasMore={state.hasMoreProducts}
            loaded
            refreshing={state.busy === 'refreshing'}
            onLoadMore={() => void journey.loadMoreProducts(session)}
            onRefresh={() => void journey.reload()}
          />
        </>
      )}
    </>
  );
}

export function AccountPage() {
  const { api, signOut } = useAuth();
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [failureCount, setFailureCount] = useState(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);
    setPending(true);
    setFailure(null);
    try {
      await api.changePassword(String(form.get('currentPassword') ?? ''), String(form.get('newPassword') ?? ''));
      signOut('Sua senha foi alterada. Entre novamente com a nova senha.');
    } catch (error) {
      const described = describeFailure(error, 'general');
      const message = error instanceof Error && 'status' in error && error.message ? error.message : described.message;
      if (mounted.current) {
        setFailure({ ...described, message });
        setFailureCount((count) => count + 1);
      }
    } finally {
      if (mounted.current) setPending(false);
    }
  };

  return (
    <section className="card narrow">
      <h1>Conta</h1>
      <p>
        Ao trocar a senha, todas as sessões abertas deixam de valer e você precisará entrar novamente. Não
        há recuperação de senha por e-mail nesta demonstração.
      </p>
      {failure && <Alert key={failureCount} tone="error" focusOnMount>{failure.message}</Alert>}
      <form onSubmit={(event) => void submit(event)}>
        <label htmlFor="currentPassword">Senha atual</label>
        <input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" required minLength={8} maxLength={128} />
        <label htmlFor="newPassword">Nova senha</label>
        <input id="newPassword" name="newPassword" type="password" autoComplete="new-password" required minLength={8} maxLength={128} />
        <button type="submit" className="primary" disabled={pending}>{pending ? 'Aguarde…' : 'Trocar senha'}</button>
      </form>
    </section>
  );
}
