import express from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { extractText, getDocumentProxy } from 'unpdf';
import { createRoutes } from './routes.js';
import { errorHandler } from './middlewares/error-handler.js';
import { AppError } from './errors/app-error.js';
import { createDemoCommandRateLimiter } from './middlewares/demo-command-rate-limiter.js';
import { GetCurrentDemoSessionController, GetDemoDocumentController, PrepareDemoSessionController, RestartDemoSessionController, } from './controllers/demo-session.controllers.js';
import { PrepareDemoSessionUseCase } from './use-cases/demo/prepare-demo-session.use-case.js';
import { GetCurrentDemoSessionUseCase } from './use-cases/demo/get-current-demo-session.use-case.js';
import { GetDemoDocumentUseCase } from './use-cases/demo/get-demo-document.use-case.js';
import { RestartDemoSessionUseCase } from './use-cases/demo/restart-demo-session.use-case.js';
import { deriveDemoAccessKey } from './demo/demo-scenario.js';
const USER_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const USER_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
/** Repositório em memória com a semântica do contrato (uma ativa por dono, reinício idempotente). */
class FakeDemoSessionRepository {
    sessions = [];
    async findActiveByOwner(ownerId) {
        return this.sessions.find((s) => s.ownerId === ownerId && s.state === 'ACTIVE') ?? null;
    }
    async findByIdForOwner(id, ownerId) {
        return this.sessions.find((s) => s.id === id && s.ownerId === ownerId) ?? null;
    }
    async createForOwner(ownerId, identity) {
        const active = await this.findActiveByOwner(ownerId);
        if (active)
            return { session: active, created: false };
        return { session: this.insert(ownerId, identity().sessionId), created: true };
    }
    async restart(sessionId, ownerId, identity) {
        const current = await this.findByIdForOwner(sessionId, ownerId);
        if (!current)
            return null;
        if (current.state === 'ARCHIVED')
            return this.sessions.find((s) => s.id === current.successorId) ?? null;
        current.state = 'ARCHIVED';
        const successor = this.insert(ownerId, identity().sessionId);
        current.successorId = successor.id;
        return successor;
    }
    insert(ownerId, id) {
        const session = {
            id, ownerId, companyId: crypto.randomUUID(), stockId: crypto.randomUUID(), state: 'ACTIVE',
            successorId: null, createdAt: new Date('2026-10-10T12:00:00Z'), archivedAt: null,
        };
        this.sessions.push(session);
        return session;
    }
}
describe('rotas /demo', () => {
    let server;
    let baseUrl;
    let repository;
    const authenticate = (request, _response, next) => {
        const id = request.header('x-test-user');
        if (!id)
            return next(new AppError('Token ausente.', 401));
        request.user = { id };
        next();
    };
    const passThrough = (_request, _response, next) => next();
    const unused = { handle: vi.fn() };
    async function start(options) {
        repository = new FakeDemoSessionRepository();
        const router = createRoutes({
            authenticate,
            uploadRateLimiter: passThrough,
            loginRateLimiter: passThrough,
            userRegistrationRateLimiter: passThrough,
            changePasswordRateLimiter: passThrough,
            createCompanyRateLimiter: passThrough,
            invoiceUpload: passThrough,
            controllers: {
                registerUser: unused, login: unused, createCompany: unused, listCompanies: unused,
                listCompanyStocks: unused, listProducts: unused, uploadInvoice: unused,
                confirmSuggestion: unused, rejectSuggestion: unused, listSuggestions: unused, changePassword: unused,
            },
            ...(options.enabled && {
                demo: {
                    commandRateLimiter: createDemoCommandRateLimiter(options.commandsPerMinute ?? 50),
                    controllers: {
                        prepare: new PrepareDemoSessionController(new PrepareDemoSessionUseCase(repository)),
                        current: new GetCurrentDemoSessionController(new GetCurrentDemoSessionUseCase(repository)),
                        document: new GetDemoDocumentController(new GetDemoDocumentUseCase(repository)),
                        restart: new RestartDemoSessionController(new RestartDemoSessionUseCase(repository)),
                    },
                },
            }),
        });
        const app = express();
        app.use(express.json());
        app.use(router);
        app.use(errorHandler);
        await new Promise((resolve, reject) => {
            server = app.listen(0, '127.0.0.1', (error) => error ? reject(error) : resolve());
        });
        const address = server.address();
        if (!address || typeof address === 'string')
            throw new Error('test server unavailable');
        baseUrl = `http://127.0.0.1:${address.port}`;
    }
    const call = (path, user, init = {}) => fetch(`${baseUrl}${path}`, {
        ...init,
        headers: {
            ...(user ? { 'x-test-user': user } : {}),
            ...(init.method === 'POST' ? { 'content-type': 'application/json' } : {}),
        },
    });
    const post = (path, user, body = {}) => call(path, user, { method: 'POST', body: JSON.stringify(body) });
    afterEach(async () => {
        await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    });
    describe('habilitadas', () => {
        beforeEach(() => start({ enabled: true }));
        it('POST /demo/sessions cria (201) e reutiliza (200) a sessão ativa', async () => {
            const created = await post('/demo/sessions', USER_A);
            expect(created.status).toBe(201);
            const body = await created.json();
            expect(body.status).toBe('success');
            expect(body.data.session).toMatchObject({
                state: 'ACTIVE',
                documents: [{ kind: 'initial' }, { kind: 'followup' }],
            });
            expect(JSON.stringify(body)).not.toMatch(/ownerId|\d{44}/);
            const reused = await post('/demo/sessions', USER_A);
            expect(reused.status).toBe(200);
            expect((await reused.json()).data.session.id).toBe(body.data.session.id);
            expect(repository.sessions).toHaveLength(1);
        });
        it('rejeita corpo não vazio com 400 e exige autenticação', async () => {
            expect((await post('/demo/sessions', USER_A, { ownerId: USER_B })).status).toBe(400);
            expect((await post('/demo/sessions', null)).status).toBe(401);
            expect((await call('/demo/sessions/current', null)).status).toBe(401);
            expect(repository.sessions).toHaveLength(0);
        });
        it('GET /demo/sessions/current devolve a ativa ou 404, sem expor sessões de terceiros', async () => {
            expect((await call('/demo/sessions/current', USER_A)).status).toBe(404);
            await post('/demo/sessions', USER_B);
            expect((await call('/demo/sessions/current', USER_A)).status).toBe(404);
            const own = await post('/demo/sessions', USER_A);
            const current = await call('/demo/sessions/current', USER_A);
            expect(current.status).toBe(200);
            expect((await current.json()).data.session.id).toBe((await own.json()).data.session.id);
        });
        it('baixa o PDF da sessão com cabeçalhos privados e chave exclusiva', async () => {
            const session = (await (await post('/demo/sessions', USER_A)).json()).data.session;
            const response = await call(`/demo/sessions/${session.id}/documents/followup`, USER_A);
            expect(response.status).toBe(200);
            expect(response.headers.get('content-type')).toBe('application/pdf');
            expect(response.headers.get('cache-control')).toBe('no-store');
            expect(response.headers.get('content-disposition')).toContain('demo-completa.pdf');
            const bytes = new Uint8Array(await response.arrayBuffer());
            const { text } = await extractText(await getDocumentProxy(bytes), { mergePages: true });
            expect(text.replace(/\s+/g, ' ')).toContain(deriveDemoAccessKey(session.id, 'followup'));
        });
        it('S02: sessão alheia responde 404 igual ao inexistente em download e reinício, sem alterar nada', async () => {
            const session = (await (await post('/demo/sessions', USER_A)).json()).data.session;
            const missing = crypto.randomUUID();
            const foreignDownload = await call(`/demo/sessions/${session.id}/documents/initial`, USER_B);
            const missingDownload = await call(`/demo/sessions/${missing}/documents/initial`, USER_B);
            const foreignRestart = await post(`/demo/sessions/${session.id}/restart`, USER_B);
            const missingRestart = await post(`/demo/sessions/${missing}/restart`, USER_B);
            expect([foreignDownload.status, missingDownload.status, foreignRestart.status, missingRestart.status])
                .toEqual([404, 404, 404, 404]);
            expect(await foreignDownload.text()).toBe(await missingDownload.text());
            expect(await foreignRestart.text()).toBe(await missingRestart.text());
            expect(repository.sessions).toHaveLength(1);
            expect(repository.sessions[0].state).toBe('ACTIVE');
        });
        it('valida id e tipo de documento antes de qualquer acesso', async () => {
            const session = (await (await post('/demo/sessions', USER_A)).json()).data.session;
            expect((await call(`/demo/sessions/${session.id}/documents/other`, USER_A)).status).toBe(400);
            expect((await call('/demo/sessions/not-a-uuid/documents/initial', USER_A)).status).toBe(400);
            expect((await post('/demo/sessions/not-a-uuid/restart', USER_A)).status).toBe(400);
        });
        it('S04: reinício arquiva e devolve a mesma sucessora em repetições', async () => {
            const old = (await (await post('/demo/sessions', USER_A)).json()).data.session;
            const first = await post(`/demo/sessions/${old.id}/restart`, USER_A);
            const second = await post(`/demo/sessions/${old.id}/restart`, USER_A);
            expect(first.status).toBe(200);
            const firstBody = await first.json();
            expect(firstBody.data.session.id).not.toBe(old.id);
            expect((await second.json()).data.session.id).toBe(firstBody.data.session.id);
            expect(repository.sessions).toHaveLength(2);
            const archived = await call(`/demo/sessions/${old.id}/documents/initial`, USER_A);
            expect(archived.status).toBe(409);
        });
    });
    describe('S09: limite de comandos', () => {
        it('responde 429 local ao exceder o limite por usuário, sem criar registros adicionais', async () => {
            await start({ enabled: true, commandsPerMinute: 2 });
            const session = (await (await post('/demo/sessions', USER_A)).json()).data.session;
            expect((await post(`/demo/sessions/${session.id}/restart`, USER_A)).status).toBe(200);
            const total = repository.sessions.length;
            const limited = await post(`/demo/sessions/${session.id}/restart`, USER_A);
            expect(limited.status).toBe(429);
            expect(repository.sessions).toHaveLength(total);
            // Outro usuário não é afetado, e leitura/download não consomem o limite.
            expect((await post('/demo/sessions', USER_B)).status).toBe(201);
            expect((await call('/demo/sessions/current', USER_A)).status).toBe(200);
        });
    });
    describe('S05: recurso desabilitado', () => {
        it('não expõe as rotas nem cria sessões quando DEMO_ENABLED=false', async () => {
            await start({ enabled: false });
            expect((await post('/demo/sessions', USER_A)).status).toBe(404);
            expect((await call('/demo/sessions/current', USER_A)).status).toBe(404);
            expect((await call(`/demo/sessions/${crypto.randomUUID()}/documents/initial`, USER_A)).status).toBe(404);
            expect((await post(`/demo/sessions/${crypto.randomUUID()}/restart`, USER_A)).status).toBe(404);
            expect(repository.sessions).toHaveLength(0);
        });
    });
});
//# sourceMappingURL=routes.demo.spec.js.map