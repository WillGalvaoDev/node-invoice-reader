import * as argon2 from 'argon2';
export class Argon2HashProvider {
    async generateHash(payload) {
        // argon2id é a variante padrão recomendada contra a maioria dos ataques
        return await argon2.hash(payload, {
            type: argon2.argon2id,
        });
    }
    async compareHash(payload, hashed) {
        return await argon2.verify(hashed, payload);
    }
}
//# sourceMappingURL=argon2-hash.provider.js.map