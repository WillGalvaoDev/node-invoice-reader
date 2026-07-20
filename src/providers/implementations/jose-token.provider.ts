import { SignJWT, jwtVerify } from 'jose';
import type { ITokenProvider, ITokenPayload } from '../token.provider.js';

export class JoseTokenProvider implements ITokenProvider {
  private secret: Uint8Array;

  constructor() {
    const secretKey = process.env.JWT_SECRET;
    if (!secretKey) {
      throw new Error('JWT_SECRET environment variable is missing.');
    }
    // O jose exige que a string da chave seja convertida em um Uint8Array
    this.secret = new TextEncoder().encode(secretKey);
  }

  async generateToken(payload: ITokenPayload): Promise<string> {
    return new SignJWT({ email: payload.email })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(payload.sub)
      .setIssuedAt()
      .setExpirationTime('1d') // Expira em 1 dia
      .sign(this.secret);
  }

  async verifyToken(token: string): Promise<ITokenPayload | null> {
    try {
      const { payload } = await jwtVerify(token, this.secret);
      
      if (!payload.sub || !payload.email) {
        return null;
      }

      return {
        sub: payload.sub,
        email: payload.email as string,
      };
    } catch {
      return null;
    }
  }
}