export interface ITokenPayload {
  sub: string; // ID do usuário
  email: string;
}

export interface ITokenProvider {
  generateToken(payload: ITokenPayload): Promise<string>;
  verifyToken(token: string): Promise<ITokenPayload | null>;
}