# DocScan — interface web da demonstração

Aplicação React + Vite + TypeScript servida pelo backend em `/app` (mesma origem da API). O
build (`web/dist`) é gerado no deploy e nunca versionado. Decisões e evidências:
[`docs/evidence/DP-03.md`](../docs/evidence/DP-03.md).

## Comandos

```sh
npm --prefix web ci          # instalar (uma vez)
npm run web:build            # typecheck + build estático em web/dist
npm run web:test             # testes de componente e de cliente HTTP (Vitest)
npm run web:test:e2e         # jornada no navegador (Docker + Chrome; exige `npm run build` na raiz)
npm --prefix web run dev     # Vite em dev, com proxy para o backend em 127.0.0.1:3333
```

## Estrutura

- `src/api/` — cliente HTTP (envelope, erros, Bearer), endpoints tipados e tradução de falhas.
- `src/state/auth.tsx` — token em memória; 401 encerra a sessão local.
- `src/journey/` — estado da jornada (`useJourney`) e painéis.
- `src/test/fake-backend.ts` — backend falso em memória que reproduz os contratos reais.
- `e2e/` — Playwright, orquestrador (`run.mjs`) e Gemini determinístico (`fake-gemini.mjs`).

## Regras

- Nenhum segredo, convite ou chave de IA no bundle; variáveis públicas só com configuração pública.
- Nenhum retry automático de upload, decisão ou IA.
- Conteúdo vindo da nota é sempre texto.
- O Gemini determinístico existe só para testes; o serviço público não tem endpoint de simulação.
