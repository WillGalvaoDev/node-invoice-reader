export function configureTrustProxy(app, trustedProxyHops) {
    app.set('trust proxy', trustedProxyHops === 0 ? false : trustedProxyHops);
}
//# sourceMappingURL=trust-proxy.js.map