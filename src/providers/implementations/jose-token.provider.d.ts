import type { ITokenProvider, ITokenPayload } from '../token.provider.js';
export declare class JoseTokenProvider implements ITokenProvider {
    private secret;
    constructor();
    generateToken(payload: ITokenPayload): Promise<string>;
    verifyToken(token: string): Promise<ITokenPayload | null>;
}
//# sourceMappingURL=jose-token.provider.d.ts.map