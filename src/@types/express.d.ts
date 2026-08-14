declare namespace Express {
  export interface Request {
    requestId: string;
    user: {
      id: string;
    };
  }
}
