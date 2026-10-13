import type { Application } from 'express';
import { createRenderCloudflareTrust } from './trusted-proxies.js';

/**
 * - `hops`: confia em N saltos fixos (`TRUST_PROXY_HOPS`); comportamento original.
 * - `render-cloudflare`: confiança posicional validada pelas faixas do Cloudflare
 *   (premissa documentada em `trusted-proxies.ts`); só deve ser usada no Render.
 */
export type TrustProxyMode = 'hops' | 'render-cloudflare';

export function configureTrustProxy(
  app: Application,
  trustedProxyHops: number,
  mode: TrustProxyMode = 'hops',
): void {
  if (mode === 'render-cloudflare') {
    if (trustedProxyHops !== 0) {
      throw new Error('TRUST_PROXY_MODE=render-cloudflare não pode ser combinado com TRUST_PROXY_HOPS.');
    }
    app.set('trust proxy', createRenderCloudflareTrust());
    return;
  }

  app.set('trust proxy', trustedProxyHops === 0 ? false : trustedProxyHops);
}
