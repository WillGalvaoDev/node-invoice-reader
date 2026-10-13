/**
 * Faixas de endereços das bordas do Cloudflare, usadas para reconhecer o último
 * salto confiável do `X-Forwarded-For` no modo `TRUST_PROXY_MODE=render-cloudflare`
 * (ver `trusted-proxies.ts` e docs/demo-operations-runbook.md).
 *
 * Fonte oficial: https://www.cloudflare.com/ips-v4 e https://www.cloudflare.com/ips-v6
 * Conferido em: 2026-10-13 (15 faixas IPv4, 7 IPv6).
 *
 * Atualização: `node scripts/check-cloudflare-ips.mjs` compara esta lista com a
 * oficial. Se divergir, substituir as listas abaixo, atualizar a data acima e o
 * teste de contagem em `trusted-proxies.spec.ts`. Uma faixa desatualizada degrada
 * para o comportamento de um salto (visitantes compartilham o limite), nunca para
 * confiança em valores forjados.
 */
export declare const CLOUDFLARE_IP_RANGES_FETCHED_AT = "2026-10-13";
export declare const CLOUDFLARE_IPV4_RANGES: readonly string[];
export declare const CLOUDFLARE_IPV6_RANGES: readonly string[];
//# sourceMappingURL=cloudflare-ip-ranges.d.ts.map