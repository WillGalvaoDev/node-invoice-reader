export interface ITokenPayload {
    sub: string;
    email: string;
    authVersion: number;
}
export interface ITokenProvider {
    generateToken(payload: ITokenPayload): Promise<string>;
    verifyToken(token: string): Promise<ITokenPayload | null>;
}
//# sourceMappingURL=token.provider.d.ts.map