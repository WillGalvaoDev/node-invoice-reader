/** `true` somente para um endereço único e válido dentro das faixas oficiais do Cloudflare. */
export declare function isCloudflareEdgeAddress(address: string): boolean;
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
export declare function createRenderCloudflareTrust(): (address: string, hopIndex: number) => boolean;
//# sourceMappingURL=trusted-proxies.d.ts.map