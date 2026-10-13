import { type RequestHandler, type Router } from 'express';
export declare const WEB_BASE_PATH = "/app";
/** Contrato de erro da API para qualquer rota desconhecida: nunca HTML. */
export declare const apiNotFound: RequestHandler;
export declare function webArtifactExists(distDir: string): boolean;
/**
 * Interface web estática sob `/app` (mesma origem da API). Rotas da API são
 * registradas antes e têm precedência; aqui só há arquivos do build e o index
 * para deep links sem extensão.
 */
export declare function createWebRouter(distDir: string): Router;
//# sourceMappingURL=web-app.d.ts.map