declare namespace Express {
  export interface Request {
    requestId: string;
    // Só definido após o middleware de autenticação; ausente em /login, /users e antes dele.
    user?: {
      id: string;
    };
  }
}
