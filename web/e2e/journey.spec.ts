import { expect, test, type Page } from '@playwright/test';

const GEMINI_CONTROL = process.env.E2E_GEMINI_CONTROL_URL ?? '';
const PASSWORD = 'senha-e2e-segura-123';
const INVITE = 'convite-e2e-123';

let counter = 0;
const uniqueEmail = () => `visitante-${Date.now()}-${++counter}@example.test`;

async function register(page: Page, email = uniqueEmail()) {
  await page.goto('/app/cadastro');
  await page.getByLabel('Nome').fill('Visitante E2E');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill(PASSWORD);
  await page.getByLabel('Código de convite').fill(INVITE);
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await expect(page.getByRole('heading', { name: 'Demonstração' })).toBeVisible();
  return email;
}

async function login(page: Page, email: string) {
  await page.goto('/app/entrar');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill(PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('heading', { name: 'Demonstração' })).toBeVisible();
}

async function downloadDocument(page: Page, name: RegExp, testInfo: { outputPath: (...segments: string[]) => string }) {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name }).click(),
  ]);
  const path = testInfo.outputPath(download.suggestedFilename());
  await download.saveAs(path);
  return path;
}

async function uploadFile(page: Page, path: string) {
  await page.getByLabel('Arquivo da nota').setInputFiles(path);
  await page.getByRole('button', { name: 'Enviar nota' }).click();
}

/** Capturas opcionais para evidência (E2E_SCREENSHOT_DIR); somente dados sintéticos. */
async function capture(page: Page, name: string) {
  const directory = process.env.E2E_SCREENSHOT_DIR;
  if (directory) await page.screenshot({ path: `${directory}/${name}.png`, fullPage: true });
}

const quantity = (page: Page, code: string) => page.getByTestId(`quantity-${code}`);

async function setGeminiMode(mode: 'ok' | 'rate_limit') {
  const response = await fetch(`${GEMINI_CONTROL}/__control`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mode }),
  });
  expect(response.ok).toBe(true);
}

async function reachFollowupReview(page: Page, testInfo: Parameters<typeof downloadDocument>[2]) {
  await page.getByRole('button', { name: 'Preparar ambiente' }).click();
  await expect(page.getByText('Estoque vazio.')).toBeVisible();

  const initial = await downloadDocument(page, /Baixar nota inicial/, testInfo);
  await uploadFile(page, initial);
  await expect(quantity(page, 'CAN-A')).toHaveText('10');

  const followup = await downloadDocument(page, /Baixar nota complementar/, testInfo);
  await uploadFile(page, followup);
  const review = page.getByRole('region', { name: 'Revisar sugestões' });
  await expect(review.getByRole('button', { name: /Confirmar sugestão/ })).toBeVisible();
  // O pendente não é contado: CAN-A = 12, nunca 15, e CAN-B ainda não existe no estoque.
  await expect(quantity(page, 'CAN-A')).toHaveText('12');
  await expect(quantity(page, 'CAD-A')).toHaveText('1');
  await expect(quantity(page, 'CAN-B')).toHaveCount(0);
  await capture(page, 'dp-03-revisao-pendente');
  return review;
}

test.beforeEach(async () => {
  await setGeminiMode('ok');
});

test('cadastro → sessão → duas notas → confirmar → persiste após sair e entrar', async ({ page }, testInfo) => {
  const email = await register(page);
  const review = await reachFollowupReview(page, testInfo);

  await review.getByRole('button', { name: /Confirmar sugestão/ }).click();
  await expect(quantity(page, 'CAN-A')).toHaveText('15');
  await expect(quantity(page, 'CAD-A')).toHaveText('1');
  await expect(page.getByText('Nenhuma sugestão pendente.', { exact: true })).toBeVisible();
  await capture(page, 'dp-03-estoque-confirmado');

  await page.getByRole('button', { name: 'Sair' }).click();
  await login(page, email);

  await expect(quantity(page, 'CAN-A')).toHaveText('15');
  await expect(quantity(page, 'CAD-A')).toHaveText('1');
  await expect(page.getByRole('button', { name: 'Preparar ambiente' })).toHaveCount(0);
});

test('limite do provedor, rejeição e nota duplicada sem dupla movimentação', async ({ page }, testInfo) => {
  await register(page);
  await page.getByRole('button', { name: 'Preparar ambiente' }).click();
  await expect(page.getByText('Estoque vazio.')).toBeVisible();
  const initial = await downloadDocument(page, /Baixar nota inicial/, testInfo);

  // 429 do provedor: mensagem clara, estoque intacto e reenvio manual depois.
  await setGeminiMode('rate_limit');
  await uploadFile(page, initial);
  const limited = page.getByRole('alert');
  await expect(limited).toContainText(/limite temporário/i);
  await expect(limited).toContainText(/Nenhuma alteração/i);
  await capture(page, 'dp-03-erro-limite-provedor');
  await expect(page.getByText('Estoque vazio.')).toBeVisible();
  await setGeminiMode('ok');
  await page.getByRole('button', { name: 'Enviar nota' }).click();
  await expect(quantity(page, 'CAN-A')).toHaveText('10');

  // Reenvio do mesmo documento: duplicata explicada, estoque intacto.
  await uploadFile(page, initial);
  await expect(page.getByRole('alert')).toContainText(/já foi processada/i);
  await expect(quantity(page, 'CAN-A')).toHaveText('10');

  const followup = await downloadDocument(page, /Baixar nota complementar/, testInfo);
  await uploadFile(page, followup);
  const review = page.getByRole('region', { name: 'Revisar sugestões' });
  await expect(review.getByRole('button', { name: /Rejeitar sugestão/ })).toBeVisible();
  await expect(quantity(page, 'CAN-A')).toHaveText('12');

  await review.getByRole('button', { name: /Rejeitar sugestão/ }).click();

  await expect(quantity(page, 'CAN-B')).toHaveText('3');
  await expect(quantity(page, 'CAN-A')).toHaveText('12');
  await expect(quantity(page, 'CAD-A')).toHaveText('1');
});

test('reiniciar entrega ambiente vazio; outra conta nunca vê estoque alheio', async ({ page, browser }, testInfo) => {
  await register(page);
  await page.getByRole('button', { name: 'Preparar ambiente' }).click();
  await uploadFile(page, await downloadDocument(page, /Baixar nota inicial/, testInfo));
  await expect(quantity(page, 'CAN-A')).toHaveText('10');

  await page.getByRole('button', { name: 'Reiniciar ambiente' }).click();
  await page.getByRole('button', { name: 'Confirmar reinício' }).click();
  await expect(page.getByText('Estoque vazio.')).toBeVisible();

  // Outra conta, em tela de 360 px: nunca vê estoque alheio e a página não rola na horizontal.
  const context = await browser.newContext({ viewport: { width: 360, height: 740 } });
  const other = await context.newPage();
  await register(other);
  await expect(other.getByRole('button', { name: 'Preparar ambiente' })).toBeVisible();
  await expect(other.getByTestId('quantity-CAN-A')).toHaveCount(0);
  await other.getByRole('button', { name: 'Preparar ambiente' }).click();
  await expect(other.getByText('Estoque vazio.')).toBeVisible();
  const overflow = await other.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await capture(other, 'dp-03-360px');
  await other.keyboard.press('Tab');
  expect(await other.evaluate(() => document.activeElement?.tagName)).toBeTruthy();
  await context.close();
});

test('deep link, refresh e rota de API desconhecida mantêm os contratos', async ({ page, request }) => {
  await page.goto('/app/demo');
  await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible();

  const unknown = await request.get('/api-inexistente');
  expect(unknown.status()).toBe(404);
  expect(unknown.headers()['content-type']).toContain('application/json');
  expect(await unknown.json()).toMatchObject({ status: 'error' });
});
