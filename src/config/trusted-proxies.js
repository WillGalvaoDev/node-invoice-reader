import { BlockList, isIP } from 'node:net';
import { CLOUDFLARE_IPV4_RANGES, CLOUDFLARE_IPV6_RANGES } from './cloudflare-ip-ranges.js';
const cloudflareEdges = new BlockList();
for (const cidr of CLOUDFLARE_IPV4_RANGES)
    addSubnet(cidr, 'ipv4');
for (const cidr of CLOUDFLARE_IPV6_RANGES)
    addSubnet(cidr, 'ipv6');
function addSubnet(cidr, family) {
    const [network, prefix] = cidr.split('/');
    cloudflareEdges.addSubnet(network, Number(prefix), family);
}
const IPV4_MAPPED_IN_IPV6 = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i;
/** `true` somente para um endereço único e válido dentro das faixas oficiais do Cloudflare. */
export function isCloudflareEdgeAddress(address) {
    const candidate = IPV4_MAPPED_IN_IPV6.exec(address)?.[1] ?? address;
    const family = isIP(candidate);
    if (family === 0)
        return false;
    return cloudflareEdges.check(candidate, family === 4 ? 'ipv4' : 'ipv6');
}
/**
 * Função de confiança do Express (`app.set('trust proxy', fn)`) para o Render.
 *
 * Premissa de infraestrutura (a ser confirmada no ambiente, ver DP-04/D03):
 * um serviço público do Render só é alcançado por seu roteamento, que
 * recebe o tráfego do Cloudflare. Portanto:
 *   - índice 0 (o socket) é o roteamento do Render — confiável por posição, pois o
 *     endereço dele não é documentado e redes privadas NÃO são confiadas por faixa;
 *   - índice 1 (último item do `X-Forwarded-For`, acrescentado pelo roteamento) só é
 *     confiável se for uma borda do Cloudflare publicada;
 *   - qualquer outro endereço encerra a cadeia: é o visitante. Valores forjados à
 *     esquerda nunca são avaliados.
 *
 * Cadeia incompleta (sem Cloudflare): o índice 1 é o visitante, que não está nas
 * faixas; a avaliação para ali e a identidade é ele, não o valor forjado.
 * Se o Render mudar a topologia ou o serviço deixar de ser público, a premissa
 * precisa ser reavaliada.
 */
export function createRenderCloudflareTrust() {
    return (address, hopIndex) => hopIndex === 0 || (hopIndex === 1 && isCloudflareEdgeAddress(address));
}
//# sourceMappingURL=trusted-proxies.js.map