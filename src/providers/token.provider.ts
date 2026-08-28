export interface ITokenPayload {
  sub: string; // ID do usuário
  email: string;
  // Comparado com User.authVersion em ensureAuthenticated (P2-02). Token sem
  // esta claim, ou com tipo inválido, deve ser tratado como inválido por quem
  // implementa verifyToken — nunca assumido como versão 1 por omissão.
  authVersion: number;
}

export interface ITokenProvider {
  generateToken(payload: ITokenPayload): Promise<string>;
  verifyToken(token: string): Promise<ITokenPayload | null>;
}