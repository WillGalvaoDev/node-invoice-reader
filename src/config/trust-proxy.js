import { createRenderCloudflareTrust } from './trusted-proxies.js';
export function configureTrustProxy(app, trustedProxyHops, mode = 'hops') {
    if (mode === 'render-cloudflare') {
        if (trustedProxyHops !== 0) {
            throw new Error('TRUST_PROXY_MODE=render-cloudflare não pode ser combinado com TRUST_PROXY_HOPS.');
        }
        app.set('trust proxy', createRenderCloudflareTrust());
        return;
    }
    app.set('trust proxy', trustedProxyHops === 0 ? false : trustedProxyHops);
}
//# sourceMappingURL=trust-proxy.js.map