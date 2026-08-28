import { SignJWT, jwtVerify } from 'jose';
import { env } from '../../config/env.js';
function isValidAuthVersion(value) {
    return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}
export class JoseTokenProvider {
    secret;
    constructor() {
        // O jose exige que a string da chave seja convertida em um Uint8Array
        this.secret = new TextEncoder().encode(env.JWT_SECRET);
    }
    async generateToken(payload) {
        return new SignJWT({ email: payload.email, authVersion: payload.authVersion })
            .setProtectedHeader({ alg: 'HS256' })
            .setSubject(payload.sub)
            .setIssuedAt()
            .setExpirationTime('1d') // Expira em 1 dia
            .sign(this.secret);
    }
    async verifyToken(token) {
        try {
            const { payload } = await jwtVerify(token, this.secret);
            if (!payload.sub || !payload.email) {
                return null;
            }
            // Token emitido antes desta claim existir (ou com claim adulterada/de
            // tipo inválido) é tratado como inválido — nunca como versão 1 por
            // omissão. Efeito pretendido: tokens pré-P2-02 deixam de valer.
            if (!isValidAuthVersion(payload.authVersion)) {
                return null;
            }
            return {
                sub: payload.sub,
                email: payload.email,
                authVersion: payload.authVersion,
            };
        }
        catch {
            return null;
        }
    }
}
//# sourceMappingURL=jose-token.provider.js.map