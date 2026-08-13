export interface ITokenPayload {
    sub: string;
    email: string;
}
export interface ITokenProvider {
    generateToken(payload: ITokenPayload): Promise<string>;
    verifyToken(token: string): Promise<ITokenPayload | null>;
}
//# sourceMappingURL=token.provider.d.ts.map