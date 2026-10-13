import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { AuthProvider } from './state/auth';
import { createFakeBackend, errorResponse, PASSWORD, type FakeBackend } from './test/fake-backend';

let backend: FakeBackend;

function renderApp(path = '/app/') {
  window.history.replaceState(null, '', path);
  return render(
    <AuthProvider fetchImpl={backend.fetch}>
      <App />
    </AuthProvider>,
  );
}

async function signIn(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('E-mail'), 'visitante@example.test');
  await user.type(screen.getByLabelText('Senha'), PASSWORD);
  await user.click(screen.getByRole('button', { name: 'Entrar' }));
}

/** Entra pela rota de login e chega à jornada. */
async function openJourney(user: ReturnType<typeof userEvent.setup>) {
  const view = renderApp('/app/entrar');
  await signIn(user);
  await screen.findByRole('heading', { name: 'Demonstração' });
  return view;
}

const pdf = (name: string) => new File(['%PDF-1.4'], name, { type: 'application/pdf' });

beforeEach(() => {
  backend = createFakeBackend();
  URL.createObjectURL = vi.fn(() => 'blob:documento');
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('acesso', () => {
  it('apresentação informa dados sintéticos e disponibilidade variável, sem expor convite ou chaves', () => {
    renderApp('/app/');

    expect(screen.getByRole('heading', { level: 1, name: /DocScan/ })).toBeInTheDocument();
    expect(screen.getAllByText(/dados sintéticos/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/disponibilidade/i).length).toBeGreaterThan(0);
    expect(document.body.textContent).not.toMatch(/convite-valido|GEMINI|api[_ ]?key/i);
  });

  it('rota protegida sem login leva à entrada; login válido leva à jornada com o token só no cabeçalho', async () => {
    const user = userEvent.setup();
    renderApp('/app/demo');
    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument();

    await signIn(user);

    expect(await screen.findByRole('heading', { name: 'Demonstração' })).toBeInTheDocument();
    const authorized = backend.calls.filter((call) => call.path.startsWith('/demo/sessions'));
    expect(authorized.length).toBeGreaterThan(0);
    expect(authorized.every((call) => call.authorization === 'Bearer jwt-do-teste')).toBe(true);
    expect(backend.calls.some((call) => call.path.includes('jwt-do-teste'))).toBe(false);
  });

  it('credencial inválida mostra erro acessível, devolve o foco ao aviso e não duplica a submissão', async () => {
    const user = userEvent.setup();
    renderApp('/app/entrar');
    await user.type(screen.getByLabelText('E-mail'), 'visitante@example.test');
    await user.type(screen.getByLabelText('Senha'), 'errada-errada');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('E-mail ou senha inválidos.');
    expect(alert).toHaveFocus();
    expect(backend.calls.filter((call) => call.path === '/login')).toHaveLength(1);
  });

  it('cadastro com convite válido cria a conta e entra; convite inválido mostra recusa genérica', async () => {
    const user = userEvent.setup();
    renderApp('/app/cadastro');
    await user.type(screen.getByLabelText('Nome'), 'Visitante Demo');
    await user.type(screen.getByLabelText('E-mail'), 'visitante@example.test');
    await user.type(screen.getByLabelText('Senha'), PASSWORD);
    await user.type(screen.getByLabelText('Código de convite'), 'errado');
    await user.click(screen.getByRole('button', { name: 'Criar conta' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Cadastro não permitido.');

    await user.clear(screen.getByLabelText('Código de convite'));
    await user.type(screen.getByLabelText('Código de convite'), 'convite-valido');
    await user.click(screen.getByRole('button', { name: 'Criar conta' }));

    expect(await screen.findByRole('heading', { name: 'Demonstração' })).toBeInTheDocument();
  });

  it('sessão expirada durante o uso encerra a sessão local e pede novo login', async () => {
    const user = userEvent.setup();
    await openJourney(user);
    await user.click(await screen.findByRole('button', { name: 'Preparar ambiente' }));
    await screen.findByText('Estoque vazio.');

    backend.state.validToken = false;
    await user.upload(screen.getByLabelText('Arquivo da nota'), pdf('demo-inicial.pdf'));
    await user.click(screen.getByRole('button', { name: 'Enviar nota' }));

    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/sessão expirou/i);
  });
});

describe('jornada de demonstração', () => {
  it('prepara o ambiente, mostra estoque vazio e baixa documentos com cliente autenticado', async () => {
    const user = userEvent.setup();
    await openJourney(user);

    await user.click(await screen.findByRole('button', { name: 'Preparar ambiente' }));

    expect(await screen.findByText('Estoque vazio.')).toBeInTheDocument();
    expect(screen.getByText('Nenhuma sugestão pendente.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Baixar nota inicial/ }));

    await waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:documento'));
    const download = backend.calls.find((call) => call.path.endsWith('/documents/initial'));
    expect(download?.authorization).toBe('Bearer jwt-do-teste');
    expect(download?.path).not.toContain('token');
  });

  it('retoma a sessão persistida ao reentrar, sem preparar outra', async () => {
    const user = userEvent.setup();
    const firstView = await openJourney(user);
    await user.click(await screen.findByRole('button', { name: 'Preparar ambiente' }));
    await screen.findByText('Estoque vazio.');
    const preparedBefore = backend.calls.filter((call) => call.method === 'POST' && call.path === '/demo/sessions').length;

    // Nova montagem da aplicação (reentrada): token novamente em memória, sessão reencontrada pela API.
    firstView.unmount();
    const again = userEvent.setup();
    await openJourney(again);

    expect(screen.queryByRole('button', { name: 'Preparar ambiente' })).not.toBeInTheDocument();
    expect(await screen.findByText('Estoque vazio.')).toBeInTheDocument();
    expect(backend.calls.filter((call) => call.method === 'POST' && call.path === '/demo/sessions')).toHaveLength(preparedBefore);
  });

  it('caminho confirmando: pendente nunca conta como disponível; confirmar soma uma vez', async () => {
    const user = userEvent.setup();
    await openJourney(user);
    await user.click(await screen.findByRole('button', { name: 'Preparar ambiente' }));
    await screen.findByText('Estoque vazio.');

    await user.upload(screen.getByLabelText('Arquivo da nota'), pdf('demo-inicial.pdf'));
    await user.click(screen.getByRole('button', { name: 'Enviar nota' }));
    const stock = await screen.findByRole('region', { name: 'Estoque' });
    await waitFor(() => expect(within(stock).getByText('CAN-A')).toBeInTheDocument());
    expect(within(stock).getByTestId('quantity-CAN-A')).toHaveTextContent('10');

    await user.upload(screen.getByLabelText('Arquivo da nota'), pdf('demo-completa.pdf'));
    await user.click(screen.getByRole('button', { name: 'Enviar nota' }));

    const review = await screen.findByRole('region', { name: 'Revisar sugestões' });
    expect((await within(review).findAllByText(/CAN-B/)).length).toBeGreaterThan(0);
    expect(within(stock).getByTestId('quantity-CAN-A')).toHaveTextContent('12');
    expect(within(stock).getByText('CAD-A')).toBeInTheDocument();
    expect(within(stock).queryByText('CAN-B')).not.toBeInTheDocument();

    await user.click(within(review).getByRole('button', { name: /Confirmar sugestão/ }));

    await waitFor(() => expect(within(stock).getByTestId('quantity-CAN-A')).toHaveTextContent('15'));
    expect(screen.getByText('Nenhuma sugestão pendente.')).toBeInTheDocument();
    expect(backend.calls.filter((call) => call.path.endsWith('/confirm'))).toHaveLength(1);
  });

  it('caminho rejeitando cria o produto novo e mantém o saldo da caneta', async () => {
    const user = userEvent.setup();
    await openJourney(user);
    await user.click(await screen.findByRole('button', { name: 'Preparar ambiente' }));
    await screen.findByText('Estoque vazio.');
    await user.upload(screen.getByLabelText('Arquivo da nota'), pdf('demo-inicial.pdf'));
    await user.click(screen.getByRole('button', { name: 'Enviar nota' }));
    await screen.findByTestId('quantity-CAN-A');
    await user.upload(screen.getByLabelText('Arquivo da nota'), pdf('demo-completa.pdf'));
    await user.click(screen.getByRole('button', { name: 'Enviar nota' }));
    const review = await screen.findByRole('region', { name: 'Revisar sugestões' });

    await user.click(await within(review).findByRole('button', { name: /Rejeitar sugestão/ }));

    expect(await screen.findByTestId('quantity-CAN-B')).toHaveTextContent('3');
    expect(screen.getByTestId('quantity-CAN-A')).toHaveTextContent('12');
  });

  it('mostra o conteúdo extraído como texto, nunca como HTML', async () => {
    const user = userEvent.setup();
    await openJourney(user);
    await user.click(await screen.findByRole('button', { name: 'Preparar ambiente' }));
    await screen.findByText('Estoque vazio.');
    await user.upload(screen.getByLabelText('Arquivo da nota'), pdf('demo-inicial.pdf'));
    await user.click(screen.getByRole('button', { name: 'Enviar nota' }));
    await screen.findByTestId('quantity-CAN-A');
    await user.upload(screen.getByLabelText('Arquivo da nota'), pdf('demo-completa.pdf'));
    await user.click(screen.getByRole('button', { name: 'Enviar nota' }));

    const review = await screen.findByRole('region', { name: 'Revisar sugestões' });
    expect(await within(review).findByText(/<img src=x onerror=alert\(1\)>/)).toBeInTheDocument();
    expect(document.querySelector('img')).toBeNull();
  });

  it('envia uma solicitação por vez e desabilita o botão enquanto processa', async () => {
    const user = userEvent.setup();
    await openJourney(user);
    await user.click(await screen.findByRole('button', { name: 'Preparar ambiente' }));
    await screen.findByText('Estoque vazio.');
    let release: () => void = () => undefined;
    backend.holdUpload = new Promise<void>((resolve) => { release = resolve; });
    const again = user;

    await again.upload(screen.getByLabelText('Arquivo da nota'), pdf('demo-inicial.pdf'));
    const send = screen.getByRole('button', { name: 'Enviar nota' });
    await again.click(send);

    expect(await screen.findByText('Processando a nota…')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Processando/ })).toBeDisabled();
    await again.click(screen.getByRole('button', { name: /Processando/ })).catch(() => undefined);
    release();
    await screen.findByTestId('quantity-CAN-A');
    expect(backend.calls.filter((call) => call.path === '/invoices/upload')).toHaveLength(1);
  });

  it('reiniciar exige confirmação, arquiva e mostra ambiente vazio', async () => {
    const user = userEvent.setup();
    await openJourney(user);
    await user.click(await screen.findByRole('button', { name: 'Preparar ambiente' }));
    await screen.findByText('Estoque vazio.');
    await user.upload(screen.getByLabelText('Arquivo da nota'), pdf('demo-inicial.pdf'));
    await user.click(screen.getByRole('button', { name: 'Enviar nota' }));
    await screen.findByTestId('quantity-CAN-A');

    await user.click(screen.getByRole('button', { name: 'Reiniciar ambiente' }));
    expect(screen.getByText(/arquiva o ambiente atual/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(backend.calls.some((call) => call.path.endsWith('/restart'))).toBe(false);

    await user.click(screen.getByRole('button', { name: 'Reiniciar ambiente' }));
    await user.click(screen.getByRole('button', { name: 'Confirmar reinício' }));

    expect(await screen.findByText('Estoque vazio.')).toBeInTheDocument();
    expect(backend.calls.filter((call) => call.path.endsWith('/restart'))).toHaveLength(1);
  });

  it('reinício interrompido: estado desconhecido, relê o ambiente ativo e não supõe rollback', async () => {
    const user = userEvent.setup();
    await openJourney(user);
    await user.click(await screen.findByRole('button', { name: 'Preparar ambiente' }));
    await screen.findByText('Estoque vazio.');
    await user.upload(screen.getByLabelText('Arquivo da nota'), pdf('demo-inicial.pdf'));
    await user.click(screen.getByRole('button', { name: 'Enviar nota' }));
    await screen.findByTestId('quantity-CAN-A');
    backend.failNext.networkAfterRestart = true;

    await user.click(screen.getByRole('button', { name: 'Reiniciar ambiente' }));
    await user.click(screen.getByRole('button', { name: 'Confirmar reinício' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/pode ou não ter sido processada/i);
    // O servidor já havia trocado o ambiente: a tela reflete o ambiente ativo real (vazio).
    expect(await screen.findByText('Estoque vazio.')).toBeInTheDocument();
    expect(screen.queryByTestId('quantity-CAN-A')).not.toBeInTheDocument();
    expect(backend.calls.filter((call) => call.path.endsWith('/restart'))).toHaveLength(1);
  });

  it('pagina o estoque com "Carregar mais produtos"', async () => {
    const user = userEvent.setup();
    backend.state.pageSize = 1;
    await openJourney(user);
    await user.click(await screen.findByRole('button', { name: 'Preparar ambiente' }));
    await screen.findByText('Estoque vazio.');
    await user.upload(screen.getByLabelText('Arquivo da nota'), pdf('demo-inicial.pdf'));
    await user.click(screen.getByRole('button', { name: 'Enviar nota' }));
    await screen.findByTestId('quantity-CAN-A');
    await user.upload(screen.getByLabelText('Arquivo da nota'), pdf('demo-completa.pdf'));
    await user.click(screen.getByRole('button', { name: 'Enviar nota' }));
    await screen.findByRole('region', { name: 'Revisar sugestões' });

    expect(screen.queryByTestId('quantity-CAD-A')).not.toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: 'Carregar mais produtos' }));

    expect(await screen.findByTestId('quantity-CAD-A')).toBeInTheDocument();
  });
});

describe('erros e recuperação (sem retry automático)', () => {
  async function prepared(user: ReturnType<typeof userEvent.setup>) {
    await openJourney(user);
    await user.click(await screen.findByRole('button', { name: 'Preparar ambiente' }));
    await screen.findByText('Estoque vazio.');
  }

  async function sendInitial(user: ReturnType<typeof userEvent.setup>) {
    await user.upload(screen.getByLabelText('Arquivo da nota'), pdf('demo-inicial.pdf'));
    await user.click(screen.getByRole('button', { name: 'Enviar nota' }));
  }

  it.each([
    ['409 nota duplicada', errorResponse(409, 'Esta NF-e já foi processada.'), /já foi processada/i],
    ['422 conflito', errorResponse(422, 'O código já existe neste estoque com fornecedor ou unidade incompatível.'), /fornecedor ou unidade incompatível/i],
    ['429 local', errorResponse(429, 'Limite de uploads atingido.', { 'retry-after': '30' }), /30 segundos/],
    ['503 provedor', errorResponse(503, 'O serviço de IA atingiu um limite temporário. Nenhuma alteração desta nota foi aplicada ao estoque. Tente novamente mais tarde.'), /limite temporário/i],
  ])('%s: mensagem específica, foco no aviso e nenhuma segunda chamada', async (_name, response, expected) => {
    const user = userEvent.setup();
    await prepared(user);
    backend.failNext.upload = response;

    await sendInitial(user);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(expected);
    expect(alert).toHaveFocus();
    expect(backend.calls.filter((call) => call.path === '/invoices/upload')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Enviar nota' })).toBeEnabled();
  });

  it('timeout/rede após envio: estado desconhecido, consulta estoque e não afirma rollback', async () => {
    const user = userEvent.setup();
    await prepared(user);
    backend.failNext.networkOnUpload = true;
    const productCallsBefore = backend.calls.filter((call) => call.path.startsWith('/products')).length;

    await sendInitial(user);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/pode ou não ter sido processada/i);
    expect(alert.textContent).not.toMatch(/revertid|rollback/i);
    await waitFor(() => expect(backend.calls.filter((call) => call.path.startsWith('/products')).length).toBeGreaterThan(productCallsBefore));
    expect(backend.calls.filter((call) => call.path === '/invoices/upload')).toHaveLength(1);
  });

  it('decisão já tomada em outra aba recarrega o estado em vez de somar localmente', async () => {
    const user = userEvent.setup();
    await prepared(user);
    await sendInitial(user);
    await screen.findByTestId('quantity-CAN-A');
    await user.upload(screen.getByLabelText('Arquivo da nota'), pdf('demo-completa.pdf'));
    await user.click(screen.getByRole('button', { name: 'Enviar nota' }));
    const review = await screen.findByRole('region', { name: 'Revisar sugestões' });
    const button = await within(review).findByRole('button', { name: /Confirmar sugestão/ });

    // Outra aba confirmou antes: o estado do servidor já mudou.
    const pen = backend.state.products.find((item) => item.code === 'CAN-A')!;
    pen.quantity += 3;
    backend.state.suggestions = [];
    backend.failNext.decision = errorResponse(409, 'Sugestão já decidida.');
    await user.click(button);

    expect(await screen.findByRole('alert')).toHaveTextContent(/já foi decidida/i);
    await waitFor(() => expect(screen.getByTestId('quantity-CAN-A')).toHaveTextContent('15'));
    expect(screen.getByText('Nenhuma sugestão pendente.')).toBeInTheDocument();
  });
});

describe('conta', () => {
  it('troca de senha explica a nova autenticação e volta à entrada; erro de senha atual não encerra a sessão', async () => {
    const user = userEvent.setup();
    await openJourney(user);
    await user.click(screen.getByRole('link', { name: 'Conta' }));

    await user.type(screen.getByLabelText('Senha atual'), 'incorreta-incorreta');
    await user.type(screen.getByLabelText('Nova senha'), 'nova-senha-123');
    await user.click(screen.getByRole('button', { name: 'Trocar senha' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Senha atual incorreta.');
    expect(screen.getByRole('heading', { name: 'Conta' })).toBeInTheDocument();

    await user.clear(screen.getByLabelText('Senha atual'));
    await user.type(screen.getByLabelText('Senha atual'), PASSWORD);
    await user.click(screen.getByRole('button', { name: 'Trocar senha' }));

    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/senha foi alterada.*entre novamente/i);
  });

  it('sair apaga o token e bloqueia a jornada', async () => {
    const user = userEvent.setup();
    await openJourney(user);

    await user.click(screen.getByRole('button', { name: 'Sair' }));

    expect(await screen.findByRole('heading', { name: 'DocScan — leitura inteligente de notas fiscais' })).toBeInTheDocument();
    window.history.replaceState(null, '', '/app/demo');
  });
});
