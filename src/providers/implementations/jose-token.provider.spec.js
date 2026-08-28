import { describe, expect, it, vi } from 'vitest';
vi.mock('../../config/env.js', () => ({
    env: { JWT_SECRET: 'test-jwt-secret-32-characters-minimum' },
}));
const { JoseTokenProvider } = await import('./jose-token.provider.js');
describe('JoseTokenProvider', () => {
    it('embute authVersion no token e devolve-o na verificação', async () => {
        const sut = new JoseTokenProvider();
        const token = await sut.generateToken({ sub: 'user-1', email: 'user@test.local', authVersion: 3 });
        const decoded = await sut.verifyToken(token);
        expect(decoded).toEqual({ sub: 'user-1', email: 'user@test.local', authVersion: 3 });
    });
    it('rejeita (null) token sem a claim authVersion — simula token emitido antes desta tarefa', async () => {
        // jose não expõe um jeito de assinar um payload arbitrário via SignJWT sem
        // passar pelas claims declaradas, então construímos o JWT "legado" à mão
        // com a mesma chave, reproduzindo exatamente o formato anterior a esta tarefa.
        const { SignJWT } = await import('jose');
        const secret = new TextEncoder().encode('test-jwt-secret-32-characters-minimum');
        const legacyToken = await new SignJWT({ email: 'user@test.local' })
            .setProtectedHeader({ alg: 'HS256' })
            .setSubject('user-1')
            .setIssuedAt()
            .setExpirationTime('1d')
            .sign(secret);
        const sut = new JoseTokenProvider();
        await expect(sut.verifyToken(legacyToken)).resolves.toBeNull();
    });
    it.each([
        ['string', '1'],
        ['fração', 1.5],
        ['negativo', -1],
    ])('rejeita (null) authVersion do tipo %s', async (_case, invalidAuthVersion) => {
        const { SignJWT } = await import('jose');
        const secret = new TextEncoder().encode('test-jwt-secret-32-characters-minimum');
        const tampered = await new SignJWT({ email: 'user@test.local', authVersion: invalidAuthVersion })
            .setProtectedHeader({ alg: 'HS256' })
            .setSubject('user-1')
            .setIssuedAt()
            .setExpirationTime('1d')
            .sign(secret);
        const sut = new JoseTokenProvider();
        await expect(sut.verifyToken(tampered)).resolves.toBeNull();
    });
    it('aceita authVersion zero — usuário nunca trocou de senha não é o mesmo que claim ausente', async () => {
        const sut = new JoseTokenProvider();
        const token = await sut.generateToken({ sub: 'user-1', email: 'user@test.local', authVersion: 0 });
        await expect(sut.verifyToken(token)).resolves.toEqual({ sub: 'user-1', email: 'user@test.local', authVersion: 0 });
    });
});
//# sourceMappingURL=jose-token.provider.spec.js.map