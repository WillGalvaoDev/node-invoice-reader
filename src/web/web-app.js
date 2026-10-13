import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import express, {} from 'express';
export const WEB_BASE_PATH = '/app';
// Sem 'unsafe-inline' em scripts e sem 'unsafe-eval'. O bundle é servido da própria origem
// e a interface só fala com a API na mesma origem.
const CONTENT_SECURITY_POLICY = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
].join('; ');
const API_NOT_FOUND = { status: 'error', message: 'Rota não encontrada.' };
/** Contrato de erro da API para qualquer rota desconhecida: nunca HTML. */
export const apiNotFound = (_request, response) => {
    response.status(404).json(API_NOT_FOUND);
};
export function webArtifactExists(distDir) {
    return existsSync(join(resolve(distDir), 'index.html'));
}
/**
 * Interface web estática sob `/app` (mesma origem da API). Rotas da API são
 * registradas antes e têm precedência; aqui só há arquivos do build e o index
 * para deep links sem extensão.
 */
export function createWebRouter(distDir) {
    const root = resolve(distDir);
    const router = express.Router();
    const secure = (_request, response, next) => {
        response.set('Content-Security-Policy', CONTENT_SECURITY_POLICY);
        next();
    };
    router.get('/', (_request, response) => response.redirect(302, `${WEB_BASE_PATH}/`));
    // Roteamento não estrito: '/app' e '/app/' casam o mesmo padrão; só o primeiro redireciona.
    router.get(WEB_BASE_PATH, (request, response, next) => {
        if (request.path !== WEB_BASE_PATH) {
            next();
            return;
        }
        response.redirect(302, `${WEB_BASE_PATH}/`);
    });
    router.use(WEB_BASE_PATH, secure, express.static(root, {
        index: false,
        fallthrough: true,
        dotfiles: 'ignore',
        setHeaders: (response, filePath) => {
            response.setHeader('Cache-Control', /[\\/]assets[\\/]/.test(filePath) ? 'public, max-age=31536000, immutable' : 'no-cache');
        },
    }));
    router.get(`${WEB_BASE_PATH}/*path`, secure, (request, response, next) => {
        const segments = request.path.split('/');
        const last = segments[segments.length - 1] ?? '';
        // Arquivo com extensão que não existe é 404 de verdade, não o index.
        if (last.includes('.')) {
            next();
            return;
        }
        response.set('Cache-Control', 'no-cache');
        response.sendFile(join(root, 'index.html'));
    });
    router.get(`${WEB_BASE_PATH}/`, secure, (_request, response) => {
        response.set('Cache-Control', 'no-cache');
        response.sendFile(join(root, 'index.html'));
    });
    return router;
}
//# sourceMappingURL=web-app.js.map