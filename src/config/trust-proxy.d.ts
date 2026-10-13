import type { Application } from 'express';
/**
 * - `hops`: confia em N saltos fixos (`TRUST_PROXY_HOPS`); comportamento original.
 * - `render-cloudflare`: confiança posicional validada pelas faixas do Cloudflare
 *   (premissa documentada em `trusted-proxies.ts`); só deve ser usada no Render.
 */
export type TrustProxyMode = 'hops' | 'render-cloudflare';
export declare function configureTrustProxy(app: Application, trustedProxyHops: number, mode?: TrustProxyMode): void;
//# sourceMappingURL=trust-proxy.d.ts.map