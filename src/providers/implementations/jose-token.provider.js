import { SignJWT, jwtVerify } from 'jose';
import { env } from '../../config/env.js';
export class JoseTokenProvider {
    secret;
    constructor() {
        // O jose exige que a string da chave seja convertida em um Uint8Array
        this.secret = new TextEncoder().encode(env.JWT_SECRET);
    }
    async generateToken(payload) {
        return new SignJWT({ email: payload.email })
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
            return {
                sub: payload.sub,
                email: payload.email,
            };
        }
        catch {
            return null;
        }
    }
}
//# sourceMappingURL=jose-token.provider.js.map