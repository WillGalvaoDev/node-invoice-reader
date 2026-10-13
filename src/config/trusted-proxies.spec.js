import { describe, expect, it } from 'vitest';
import { CLOUDFLARE_IPV4_RANGES, CLOUDFLARE_IPV6_RANGES } from './cloudflare-ip-ranges.js';
import { isCloudflareEdgeAddress } from './trusted-proxies.js';
describe('faixas oficiais do Cloudflare', () => {
    it('reconhece endereços IPv4 e IPv6 dentro das faixas', () => {
        expect(isCloudflareEdgeAddress('172.70.10.1')).toBe(true);
        expect(isCloudflareEdgeAddress('104.16.0.1')).toBe(true);
        expect(isCloudflareEdgeAddress('2606:4700:10::1')).toBe(true);
        expect(isCloudflareEdgeAddress('2a06:98c0::1')).toBe(true);
    });
    it('reconhece IPv4 mapeado em IPv6', () => {
        expect(isCloudflareEdgeAddress('::ffff:172.70.10.1')).toBe(true);
        expect(isCloudflareEdgeAddress('::ffff:203.0.113.1')).toBe(false);
    });
    it('respeita os limites das faixas (primeiro/último endereço dentro, vizinho fora)', () => {
        expect(isCloudflareEdgeAddress('173.245.48.0')).toBe(true);
        expect(isCloudflareEdgeAddress('173.245.63.255')).toBe(true);
        expect(isCloudflareEdgeAddress('173.245.64.0')).toBe(false);
        expect(isCloudflareEdgeAddress('173.245.47.255')).toBe(false);
    });
    it('não confia em redes privadas, loopback nem endereços públicos comuns', () => {
        for (const address of ['10.0.0.1', '172.16.0.1', '192.168.1.1', '127.0.0.1', '::1', 'fd00::1', '8.8.8.8', '203.0.113.1', '2001:db8::1']) {
            expect(isCloudflareEdgeAddress(address)).toBe(false);
        }
    });
    it('recusa entradas inválidas sem lançar exceção', () => {
        for (const address of ['', 'abc', '300.1.1.1', '172.70.10.1, 8.8.8.8', 'undefined']) {
            expect(isCloudflareEdgeAddress(address)).toBe(false);
        }
    });
    it('mantém a lista oficial em CIDR (15 IPv4 e 7 IPv6 conferidos em 2026-10-13)', () => {
        expect(CLOUDFLARE_IPV4_RANGES).toHaveLength(15);
        expect(CLOUDFLARE_IPV6_RANGES).toHaveLength(7);
        for (const cidr of [...CLOUDFLARE_IPV4_RANGES, ...CLOUDFLARE_IPV6_RANGES]) {
            expect(cidr).toMatch(/^[0-9a-f:.]+\/\d{1,3}$/i);
        }
    });
});
//# sourceMappingURL=trusted-proxies.spec.js.map