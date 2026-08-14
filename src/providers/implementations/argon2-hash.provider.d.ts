import type { IHashProvider } from '../hash.provider.js';
export declare class Argon2HashProvider implements IHashProvider {
    generateHash(payload: string): Promise<string>;
    compareHash(payload: string, hashed: string): Promise<boolean>;
}
//# sourceMappingURL=argon2-hash.provider.d.ts.map