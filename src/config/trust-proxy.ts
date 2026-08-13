import type { Application } from 'express';

export function configureTrustProxy(app: Application, trustedProxyHops: number): void {
  app.set('trust proxy', trustedProxyHops === 0 ? false : trustedProxyHops);
}

