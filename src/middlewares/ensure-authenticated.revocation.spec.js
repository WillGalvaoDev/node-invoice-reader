import express from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEnsureAuthenticated } from './ensure-authenticated.js';
import { createApp } from '../app.js';
import { InMemoryUserRepository } from '../repositories/in-memory/in-memory-user.repository.js';
vi.mock('../config/env.js', () => ({
    env: { JWT_SECRET: 'test-jwt-secret-32-characters-minimum' },
}));
const { JoseTokenProvider } = await import('../providers/implementations/jose-token.provider.js');
const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
const servers = [];
afterEach(async () => {
    await Promise.all(servers.splice(0).map((server) => new Promise((resolve) => server.close(() => resolve()))));
});
/**
 * Prova a propriedade central que motivou escolher `authVersion` em vez de
 * `passwordChangedAt`/`JWT.iat` (ver P2-02 no roadmap): a rejeição é
 * determinística e não depende de resolução de relógio. Deliberadamente não
 * avançamos nem congelamos o tempo — o teste roda na sequência natural, e a
 * revogação funciona mesmo que emissão e troca de senha caiam no mesmo
 * segundo, porque a comparação é entre inteiros, nunca entre timestamps.
 */
describe('revogação determinística de token via authVersion (P2-02)', () => {
    it('token emitido antes da troca de senha é rejeitado, ainda que emitido no mesmo segundo da troca', async () => {
        const userRepository = new InMemoryUserRepository();
        const tokenProvider = new JoseTokenProvider();
        const user = await userRepository.create({ name: 'User', email: 'user@test.local', password: 'hash' });
        const tokenIssuedBeforeChange = await tokenProvider.generateToken({
            sub: user.id, email: user.email, authVersion: 1,
        });
        // Sem sleep, sem avanço de relógio: a troca de senha acontece imediatamente
        // após a emissão do token, no mesmo tick de execução.
        await userRepository.updatePassword(user.id, 'new-hash');
        const middleware = createEnsureAuthenticated({ tokenProvider, userRepository });
        const router = express.Router();
        router.get('/protected', middleware, (request, response) => response.json({ userId: request.user.id }));
        const app = createApp({ applicationRoutes: router, healthProbe: vi.fn(), logger });
        const server = await new Promise((resolve, reject) => {
            const candidate = app.listen(0, '127.0.0.1', (error) => error ? reject(error) : resolve(candidate));
        });
        servers.push(server);
        const address = server.address();
        if (!address || typeof address === 'string')
            throw new Error('Servidor indisponível');
        const response = await fetch(`http://127.0.0.1:${address.port}/protected`, {
            headers: { authorization: `Bearer ${tokenIssuedBeforeChange}` },
        });
        expect(response.status).toBe(401);
    });
    it('token emitido depois da troca de senha é aceito', async () => {
        const userRepository = new InMemoryUserRepository();
        const tokenProvider = new JoseTokenProvider();
        const user = await userRepository.create({ name: 'User', email: 'user@test.local', password: 'hash' });
        const updated = await userRepository.updatePassword(user.id, 'new-hash');
        const tokenIssuedAfterChange = await tokenProvider.generateToken({
            sub: user.id, email: user.email, authVersion: updated.authVersion,
        });
        const middleware = createEnsureAuthenticated({ tokenProvider, userRepository });
        const router = express.Router();
        router.get('/protected', middleware, (request, response) => response.json({ userId: request.user.id }));
        const app = createApp({ applicationRoutes: router, healthProbe: vi.fn(), logger });
        const server = await new Promise((resolve, reject) => {
            const candidate = app.listen(0, '127.0.0.1', (error) => error ? reject(error) : resolve(candidate));
        });
        servers.push(server);
        const address = server.address();
        if (!address || typeof address === 'string')
            throw new Error('Servidor indisponível');
        const response = await fetch(`http://127.0.0.1:${address.port}/protected`, {
            headers: { authorization: `Bearer ${tokenIssuedAfterChange}` },
        });
        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({ userId: user.id });
    });
});
//# sourceMappingURL=ensure-authenticated.revocation.spec.js.map