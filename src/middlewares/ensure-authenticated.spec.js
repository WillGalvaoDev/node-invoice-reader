import express from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createEnsureAuthenticated } from './ensure-authenticated.js';
import { createApp } from '../app.js';
const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
const servers = [];
async function listen(app) {
    const server = await new Promise((resolve, reject) => {
        const candidate = app.listen(0, '127.0.0.1', (error) => error ? reject(error) : resolve(candidate));
    });
    servers.push(server);
    const address = server.address();
    if (!address || typeof address === 'string')
        throw new Error('Servidor indisponível');
    return `http://127.0.0.1:${address.port}`;
}
afterEach(async () => {
    await Promise.all(servers.splice(0).map((server) => new Promise((resolve) => server.close(() => resolve()))));
});
describe('createEnsureAuthenticated', () => {
    const verifyToken = vi.fn();
    const findById = vi.fn();
    const protectedHandler = vi.fn((request, response) => response.json({ userId: request.user.id }));
    beforeEach(() => {
        vi.clearAllMocks();
        verifyToken.mockResolvedValue({ sub: userId, email: 'user@test.local' });
        findById.mockResolvedValue({ id: userId, email: 'user@test.local', name: 'User' });
    });
    async function request(authorization, query = '') {
        const middleware = createEnsureAuthenticated({
            tokenProvider: { verifyToken, generateToken: vi.fn() },
            userRepository: { findById, findByEmail: vi.fn(), create: vi.fn() },
        });
        const router = express.Router();
        router.post('/protected', middleware, protectedHandler);
        const baseUrl = await listen(createApp({ applicationRoutes: router, healthProbe: vi.fn(), logger }));
        return fetch(`${baseUrl}/protected${query}`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', ...(authorization ? { authorization } : {}) },
            body: JSON.stringify({ userId: 'attacker', id: 'attacker' }),
        });
    }
    it('rejeita Authorization ausente antes do verifier e handler', async () => {
        const response = await request();
        expect(response.status).toBe(401);
        await expect(response.json()).resolves.toEqual({ status: 'error', message: 'JWT token não informado.' });
        expect(verifyToken).not.toHaveBeenCalled();
        expect(protectedHandler).not.toHaveBeenCalled();
    });
    it.each(['abc', 'Basic token', 'Bearer', 'Bearer token extra'])('rejeita header malformado: %s', async (header) => {
        const response = await request(header);
        expect(response.status).toBe(401);
        expect(verifyToken).not.toHaveBeenCalled();
        expect(protectedHandler).not.toHaveBeenCalled();
    });
    it.each([
        ['token expirado', null],
        ['assinatura inválida', new Error('JWSSignatureVerificationFailed')],
    ])('normaliza %s para 401 sem detalhes internos', async (_case, verifierResult) => {
        if (verifierResult instanceof Error)
            verifyToken.mockRejectedValueOnce(verifierResult);
        else
            verifyToken.mockResolvedValueOnce(verifierResult);
        const response = await request('Bearer valid-shape');
        expect(response.status).toBe(401);
        const body = JSON.stringify(await response.json());
        expect(body).toContain('JWT token inválido ou expirado.');
        expect(body).not.toContain('JWSSignatureVerificationFailed');
        expect(protectedHandler).not.toHaveBeenCalled();
    });
    it('rejeita usuário removido após emissão e não chama handler', async () => {
        findById.mockResolvedValueOnce(null);
        const response = await request('Bearer valid-token');
        expect(response.status).toBe(401);
        await expect(response.json()).resolves.toEqual({ status: 'error', message: 'Usuário não encontrado ou conta removida.' });
        expect(findById).toHaveBeenCalledWith(userId);
        expect(protectedHandler).not.toHaveBeenCalled();
    });
    it('anexa somente a identidade verificada e existente, ignorando body/query', async () => {
        const response = await request('Bearer valid-token', '?userId=attacker');
        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({ userId });
        expect(verifyToken).toHaveBeenCalledWith('valid-token');
        expect(protectedHandler).toHaveBeenCalledOnce();
    });
});
//# sourceMappingURL=ensure-authenticated.spec.js.map