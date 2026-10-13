// Compara as faixas versionadas em src/config/cloudflare-ip-ranges.ts com a lista
// oficial do Cloudflare. Uso manual (precisa de rede): node scripts/check-cloudflare-ips.mjs
// Saída: 0 = idênticas; 1 = divergem (atualizar o arquivo e a data); 2 = falha de rede.
import { CLOUDFLARE_IPV4_RANGES, CLOUDFLARE_IPV6_RANGES } from '../src/config/cloudflare-ip-ranges.js';

const SOURCES = [
  ['https://www.cloudflare.com/ips-v4', CLOUDFLARE_IPV4_RANGES],
  ['https://www.cloudflare.com/ips-v6', CLOUDFLARE_IPV6_RANGES],
];

let diverged = false;

for (const [url, committed] of SOURCES) {
  let response;
  try {
    response = await fetch(url);
  } catch {
    console.error(`Falha de rede ao consultar ${url}`);
    process.exit(2);
  }
  if (!response.ok) {
    console.error(`Resposta inesperada de ${url}: ${response.status}`);
    process.exit(2);
  }

  const official = (await response.text()).split(/\s+/).filter(Boolean).sort();
  const local = [...committed].sort();
  const added = official.filter((cidr) => !local.includes(cidr));
  const removed = local.filter((cidr) => !official.includes(cidr));

  if (added.length === 0 && removed.length === 0) {
    console.log(`${url}: ${official.length} faixas, sem divergência`);
    continue;
  }
  diverged = true;
  console.log(`${url}: DIVERGE`);
  for (const cidr of added) console.log(`  + ${cidr} (oficial, ausente no repositório)`);
  for (const cidr of removed) console.log(`  - ${cidr} (no repositório, ausente na oficial)`);
}

process.exit(diverged ? 1 : 0);
