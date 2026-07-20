import * as argon2 from 'argon2';
import type { IHashProvider } from '../hash.provider.js';

export class Argon2HashProvider implements IHashProvider {
  async generateHash(payload: string): Promise<string> {
    // argon2id é a variante padrão recomendada contra a maioria dos ataques
    return await argon2.hash(payload, {
      type: argon2.argon2id,
    });
  }

  async compareHash(payload: string, hashed: string): Promise<boolean> {
    return await argon2.verify(hashed, payload);
  }
}