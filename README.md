# DocScan — Leitura Inteligente de DANFE

Backend em **Node.js** + **TypeScript** que processa DANFEs (Documento Auxiliar da Nota Fiscal Eletrônica) brasileiras: extrai dados via IA, valida contra as regras do domínio fiscal, casa itens com o catálogo existente e atualiza o estoque com auditoria completa.

Este documento descreve a arquitetura **real** do sistema, tal como implementada. Para o histórico de decisões e o plano de engenharia que levou a este estado, veja `docs/auditoria-tecnica.md` e `docs/backlog-engenharia.md`.

---

## Fluxo principal

```
Imagem/PDF → OCR (Gemini) → Extração estruturada → Validação → Matching de produtos → Upsert → Auditoria
```

A IA (Google Gemini) **nunca é fonte de verdade**. Ela apenas extrai dados do documento e sugere similaridade entre um item da nota e produtos já cadastrados. Toda decisão que altera a identidade de um produto passa por confirmação humana antes de afetar o estoque — ver [Sugestões de produto](#sugestões-de-produto-human-in-the-loop) abaixo.

---

## Arquitetura

Estrutura real de `src/`:

* **`controllers/`** — Tradução HTTP ↔ use case. Sem lógica de negócio; lançam `AppError` e deixam o handler global responder.
* **`use-cases/`** — Orquestração das regras de aplicação (`ReadInvoiceUseCase`, `CreateCompanyUseCase`, `LoginUseCase`, casos de uso de sugestão de produto, etc.).
* **`domain/`** — Regras de domínio puras e determinísticas (validação de CNPJ, coerência do DANFE). Sem I/O.
* **`providers/`** — Contratos e implementações para integrações externas: `IStorageProvider` (disco), `IAiProvider` (Gemini), `IHashProvider` (Argon2), `ITokenProvider` (JWT/jose).
* **`repositories/`** — Gateways de dados: interface + implementação Prisma + dublê in-memory (para testes) de cada agregado (User, Company, Stock, Product, AuditLog, ProductSuggestion, invoice persistence).
* **`mappers/`** — Tradução explícita entre o tipo gerado pelo Prisma e o tipo de domínio (`ProductMapper`, `CompanyMapper`, `StockMapper`, `AuditLogMapper`). Nenhum repositório Prisma faz cast (`as`) direto do retorno do client para o tipo de domínio.
* **`middlewares/`** — Autenticação, rate limiting, validação declarativa (`zod`), request ID, cabeçalhos de segurança, error handler global.
* **`schemas/`** — Schemas `zod` para corpo de requisição HTTP e para a resposta estruturada do Gemini.
* **`infra/`** — Cliente Prisma único, logger estruturado, telemetria de IA, healthcheck.
* **`errors/`** — `AppError` (estende `Error`) e tradução de códigos de constraint do Prisma (`P2002`/`P2003`) para status HTTP.
* **`config/`** — Configuração centralizada e validada (`env.ts`), upload (`multer`), `trust proxy`.

Não existe camada de `entities/` nem container de DI — ver [Decisões arquiteturais deliberadas](#decisões-arquiteturais-deliberadas).

---

## API

Todas as respostas seguem o envelope `{ status: 'success', data }` ou `{ status: 'error', message }`. Erros de negócio usam `AppError` e são traduzidos pelo error handler global para o status HTTP correspondente — nenhuma rota faz comparação de string de mensagem para decidir status.

| Método | Rota | Autenticação | Descrição |
|---|---|---|---|
| `GET`  | `/health` | pública | `SELECT 1` real no Postgres; `503` se o banco estiver indisponível ou o processo em shutdown. |
| `POST` | `/users` | pública, rate limit 5/hora por IP | Cadastro de usuário. Exige `inviteCode` correto (coorte controlada do piloto); ausente ou incorreto devolve o mesmo `403` genérico. Senha com Argon2. |
| `POST` | `/login` | pública, rate limit 10/15min por IP | Autenticação; devolve JWT. |
| `POST` | `/companies` | Bearer JWT, rate limit 5/min por usuário | Cria empresa + estoque principal em uma transação atômica. |
| `GET`  | `/companies` | Bearer JWT | Lista paginada (cursor) das empresas acessíveis ao usuário — owned e onde ele é colaborador —, com o papel (`OWNER`/`COLLABORATOR`) de cada uma. |
| `GET`  | `/companies/:companyId/stocks` | Bearer JWT | Lista paginada (cursor) dos estoques visíveis da empresa. Owner vê todos; colaborador só os que têm `StockPermission.canView = true`. `404` (sem distinguir "não existe" de "sem acesso") se o usuário não tiver nenhuma relação com a empresa. |
| `GET`  | `/products` | Bearer JWT | Lista paginada (cursor) por `stockId`. Exige acesso ao estoque. |
| `POST` | `/invoices/upload` | Bearer JWT, rate limit 5/min por usuário | Upload de DANFE (JPEG/PNG/PDF, até 10 MiB, até `DANFE_MAX_ITEMS` linhas de produto). Dispara o pipeline completo. `422` se exceder o teto de itens, `503` se o matching ficar indisponível — nada é gravado e a nota pode ser reenviada. |
| `GET`  | `/stocks/:stockId/suggestions` | Bearer JWT | Lista sugestões de produto pendentes do estoque. |
| `POST` | `/suggestions/:suggestionId/confirm` | Bearer JWT | Confirma uma sugestão: aplica a entrada no produto sugerido. |
| `POST` | `/suggestions/:suggestionId/reject` | Bearer JWT | Rejeita uma sugestão: cadastra o item como produto novo. |
| `PATCH` | `/me/password` | Bearer JWT, rate limit 5/min por usuário | Troca a própria senha (`currentPassword`/`newPassword`). `204` sem corpo. Incrementa `authVersion` na mesma escrita do novo hash — todo token emitido antes da troca deixa de ser aceito, imediatamente e sem depender de comparação de timestamp. |

### Autenticação e tenancy

Bearer JWT (`Authorization: Bearer <token>`), verificado via `jose`. `req.user` só existe **depois** do middleware de autenticação — é `undefined` em `/login`, `/users` e em qualquer ponto anterior a ele (refletido no tipo: `Express.Request.user?: { id: string }`).

Autorização é sempre derivada do recurso, nunca do corpo/query da requisição: `companyId` de um upload de invoice vem do `stockId` autorizado, não de um campo enviado pelo cliente. Owner da empresa tem acesso implícito a todos os estoques; colaboradores precisam de `StockPermission` explícita (`canView`/`canCreate`) por estoque.

### Upload e pipeline de IA

1. `multer` valida tamanho (10 MiB) e MIME (`image/jpeg`, `image/png`, `application/pdf`) antes do controller.
2. Autorização de acesso ao estoque acontece **antes** de qualquer I/O — inclusive antes da leitura do arquivo do disco.
3. `IStorageProvider.readFile` lê os bytes (`Buffer`); `IAiProvider.extractDanfeData` recebe conteúdo + mimetype, nunca um caminho de arquivo.
4. Gemini extrai os dados com timeout de 30s, no máximo 2 tentativas (retry só para `429`/`5xx`/erro de rede), e a resposta é validada por schema `zod` — nada do modelo é confiado sem validação de tipo/estrutura.
5. Coerência do DANFE é verificada (soma dos itens vs. total declarado, tolerância `max(R$0,02, 1%)`) antes de qualquer persistência.
6. Matching: item com código exato atualiza o produto automaticamente. Sem código exato, um pré-filtro determinístico (léxico, sem IA) reduz o catálogo a no máximo 15 candidatos; só então o Gemini é chamado para similaridade — nunca com o estoque inteiro.
7. O resultado da similaridade tem **três estados distinguíveis pelo tipo** — `match`, `no_match` e `unavailable` — e nunca `null`. Ver [Indisponibilidade do matching](#indisponibilidade-do-matching) abaixo.
8. Toda a persistência de uma nota (upsert de produtos com custo médio ponderado, criação de sugestões, `ProcessedInvoice`) acontece em **uma única transação Postgres**. Reenvio da mesma chave de acesso é idempotente (`409` em duplicata).

### Indisponibilidade do matching

`IAiProvider.findSimilarProduct` devolve uma união discriminada, nunca `null`:

| Estado | Significado | Efeito |
|---|---|---|
| `match` | o modelo respondeu e indicou um candidato **da lista fornecida**, com confiança ≥ limiar | vira `ProductSimilaritySuggestion` pendente |
| `no_match` | o modelo respondeu validamente que não há equivalente, ou a confiança ficou abaixo do limiar, ou não havia candidato | item é cadastrado como produto novo |
| `unavailable` | **não há evidência confiável para concluir nada** | a nota inteira é abortada, sem persistir |

`unavailable` cobre timeout, falha 5xx do provedor, JSON inválido, resposta fora do schema e **ID de candidato fora da lista enviada** (alucinação — a defesa contra prompt injection continua recusando o ID; o que mudou é a conclusão).

**Falha técnica da IA não é evidência de que o item seja novo.** Quando ocorre `unavailable`, a nota é abortada **antes da transação de persistência** e a requisição responde `503`. Nada é gravado — nem produto, nem sugestão, nem `ProcessedInvoice` —, então a chave de idempotência **não é consumida** e a mesma DANFE pode ser reenviada quando o provedor voltar. O `503` é deliberadamente distinto do `400`/`422` de documento inválido: ali o problema é o documento, aqui o documento pode estar perfeito.

### Sugestões de produto (human-in-the-loop)

Quando a IA identifica um candidato por similaridade (confiança configurável via `SIMILARITY_CONFIDENCE_THRESHOLD`, default `0.7`), o item **não altera o estoque**. Uma `ProductSimilaritySuggestion` fica `PENDING` até decisão humana via `/suggestions/:id/confirm` ou `/suggestions/:id/reject`:

* **Confirmar** aplica a entrada (custo médio ponderado) no produto sugerido.
* **Rejeitar** preserva o candidato e cadastra o item recebido como produto novo.

A transição `PENDING → CONFIRMED|REJECTED` é condicional (`WHERE status = PENDING`) para impedir decisão dupla sob concorrência.

### PostgreSQL e Prisma

Um único `PrismaClient`/`Pool` (`src/infra/prisma.ts`, `max: 10`) compartilhado por todos os repositórios — não há uma pool por repositório. Migrations em `prisma/migrations/`, aplicadas com `prisma migrate deploy`; nenhuma migration histórica é editada. Índices compostos cobrem as consultas reais paginadas/de auditoria (`products(stockId, createdAt, id)`, `audit_logs(companyId, createdAt)`, `audit_logs(userId, createdAt)`, `ai_call_events(createdAt)`/`(correlationId)`/`(operation, createdAt)`).

### Observabilidade

* **Logger estruturado** (`src/infra/logger.ts`) em JSON, com `redact` recursivo de senha/hash/token/Authorization/API key, e `requestId` de correlação em toda resposta (`X-Request-Id`).
* **Auditoria de domínio** (`AuditLog`) registra criação/atualização de produto — inclusive quando a origem é confirmar/rejeitar uma sugestão de similaridade (P3-00A: mesma forma `PRODUCT`/`CREATE`|`UPDATE` com `{quantity, unitPrice, totalPrice}`, descrição própria, nunca "processado por invoice") —, criação de empresa, tentativa de acesso não autorizado e troca de senha, com `previousState`/`newState`. Best-effort: falha ao gravar auditoria nunca reverte uma operação já persistida.
* **Telemetria de IA** (`src/infra/ai-telemetry.ts`) registra, por chamada ao Gemini, duração monotônica, tentativas, tokens reais (nunca estimados), custo **estimado** em nanoUSD (`estimatedCostUsdNanos` — nunca faturado, ver `DANFE_MAX_ITEMS`/D4) e categoria de falha; e por sugestão, decisão e faixa de confiança.
* **`ai_call_events`** (P3-01, `src/infra/prisma-ai-telemetry.ts`) persiste cada chamada real ao Gemini em PostgreSQL, correlacionada por um `correlationId` (UUID) **gerado no servidor** em `ReadInvoiceUseCase.execute` — nunca aceito do cliente, ao contrário de `requestId`/`X-Request-Id`, que é guardado só para cruzar com log. `ProcessedInvoice.correlationId` (nullable) liga a nota ao custo sem nunca aparecer em log. Contrato: **observabilidade, nunca autoridade de gasto** — escrita best-effort, fora da transação de domínio; nenhum caminho de código lê `ai_call_events` para decidir se uma chamada de IA pode acontecer (isso é `ai_usage_ledger`, P4-02). Nenhum conteúdo de documento, descrição de produto ou `accessKey` é persistido — só IDs, contadores, duração e custo estimado. `userId`/`companyId`/`stockId` existem na linha (mesmo perímetro de acesso do banco) mas são deliberadamente excluídos do canal de log estruturado (whitelist positiva, mesmo princípio de `AuditLog`/P3-00B).
* **`ai_suggestion_events`** (P3-02) é uma **view** SQL, não uma tabela — `product_similarity_suggestions` já guarda confidence bruta, status, `decidedAt`/`decidedByUserId`; a view só junta `ProcessedInvoice.correlationId` e `Stock.companyId` e expande cada sugestão em um evento `created` (sempre) e, quando já decidida, um segundo evento `confirmed`/`rejected`. Sem escrita própria: não há o que falhar nem divergir do estado que já é transacional. `confidenceBucket` nunca é persistido — a faixa é calculada na consulta.
* **Runbook de telemetria** (P3-03, `docs/telemetry-runbook.md`) documenta as 8 consultas de referência do piloto sobre `ai_call_events`/`ai_suggestion_events` (latência, tokens/custo por nota, taxa de falha, distribuição e aceitação de confidence, chamadas de similaridade por nota), cada uma testada contra dado semeado real. Retenção de `ai_call_events` em 60 dias (D2) via `npm run retention:ai-call-events` (`scripts/purge-ai-call-events.mjs`) — script de operador, idempotente, nunca toca `AuditLog` nem `ai_usage_ledger`; sem scheduler automático, o Render Free não oferece cron/one-off jobs.
* **Guard de orçamento Gemini** (P4-02, D8, `src/providers/ai-budget-guard.ts` + `ai_usage_ledger`) decide, antes de cada tentativa HTTP ao Gemini, se ela pode acontecer — nunca depois. Reserva atômica (`reservedRequests`) em escopo **global** e **por usuário** dentro de uma única transação Postgres: se qualquer um dos dois excede o teto do dia, a transação inteira é revertida (nenhum decremento manual, nenhuma reserva vazada). Após a tentativa, reconciliação move a reserva para `spentRequests`/`spentTokens`/`spentCostUsdNanos` reais. **Fail-closed genuíno**: falha ao escrever no ledger recusa a chamada (`503`) — nunca um wrapper best-effort, ao contrário de `ai_call_events`. Tetos de requisições (18/dia global, 5/dia por usuário — D8) calibrados abaixo da cota real do provedor (RPD=20); **tokens deliberadamente sem teto** nesta primeira versão, por ausência de dado real do piloto — apenas observados. Kill switch (`GEMINI_ENABLED`) separado do teto: desligado é `503` sem `Retry-After` (decisão humana, sem previsão de retorno); teto atingido é `503`/`429` **com** `Retry-After` até a virada do dia. `429` do provedor nunca dispara retry (não há como distinguir de forma confiável throttling de cota esgotada).
* **Reconciliação ledger × eventos** (P3-04, `npm run reconcile:ai-usage [YYYY-MM-DD]`, sem argumento reconcilia ontem em UTC) compara `ai_usage_ledger` (autoritativo) contra `ai_call_events` (observação) — somente leitura, nunca corrige nada. A grandeza comparável para requisições é `SUM(ai_call_events.attempts)`, não `COUNT(*)`: eventos contam operações lógicas, o ledger debita por tentativa HTTP (cada retry conta). Uma tentativa recusada por cota no meio de um retry incrementa o contador de tentativas do evento antes de a reserva ser revertida — divergência de 1 unidade esperada, não anomalia. Reserva residual (`reservedRequests != 0` num período fechado) é sempre anomalia.

### Operação

* **Graceful shutdown**: `SIGTERM`/`SIGINT` drenam requisições em voo, encerram o pool do Postgres e saem com código 0; timeout configurável força o fechamento e sai com código 1.
* **`unhandledRejection`/`uncaughtException`** são logados com contexto seguro e disparam o mesmo shutdown fatal.
* **CI** (`.github/workflows/ci.yml`, GitHub Actions, `ubuntu-latest`): `prisma validate` → `prisma generate` → `typecheck` → `lint` → `build` → **guard de artefatos** (`npm run verify:artifacts`, falha se o build sujar o checkout) → suíte unitária → gate de integração PostgreSQL real (Docker); job separado valida o build de produção com **apenas** `dependencies` instaladas (`npm prune --omit=dev`) e roda `scripts/verify-production-runtime.mjs`, que importa o grafo de dependências real do artefato compilado.

---

## Variáveis de ambiente

Ver `.env.example`. Todas são validadas e falham rápido no boot (`src/config/env.ts`) — nenhuma tem fallback silencioso além dos defaults documentados.

| Variável | Obrigatória | Default | Descrição |
|---|---|---|---|
| `DATABASE_URL` | sim | — | Postgres. |
| `JWT_SECRET` | sim | — | Assinatura dos tokens (HS256). Mínimo de **32 caracteres** — o boot falha abaixo disso. Gerar com `openssl rand -base64 48`. |
| `GEMINI_API_KEY` | sim | — | Google Gemini. |
| `INVITE_CODE` | sim | — | Código de convite compartilhado exigido em `POST /users` (P4-03). Mínimo de **8 caracteres**. Nunca versionado; trocar exige só reiniciar o serviço, sem novo build. |
| `PORT` | não | `3333` | Porta HTTP. |
| `TRUST_PROXY_HOPS` | não | `0` | Número exato de proxies reversos confiáveis (0–10). Só alterar se a API estiver atrás de proxy conhecido. |
| `CORS_ALLOWED_ORIGINS` | não | vazio | Allowlist HTTP(S) separada por vírgula. Sem wildcard, sem credenciais. |
| `REQUEST_TIMEOUT_MS` | não | `120000` | Timeout de requisição do servidor HTTP. |
| `SHUTDOWN_TIMEOUT_MS` | não | `30000` | Prazo do graceful shutdown antes de forçar. |
| `GEMINI_TIMEOUT_MS` | não | `30000` | Timeout por tentativa ao Gemini. |
| `GEMINI_MAX_ATTEMPTS` | não | `2` | Tentativas totais (1–2) para erro transitório. |
| `SIMILARITY_CONFIDENCE_THRESHOLD` | não | `0.7` | Limiar de confiança do matching por similaridade (0–1). Fonte única usada no prompt e no código — não alterar sem dado real de uso. |
| `DANFE_MAX_ITEMS` | não | `100` | Máximo de linhas de produto aceitas por DANFE (1–1000). Teto operacional do piloto (D1), não regra fiscal — fonte única usada no `maxItems` do prompt e na validação do schema. Acima do limite, `422` antes de qualquer chamada de similaridade. |
| `GEMINI_ENABLED` | não | `true` | Kill switch do guard de orçamento (P4-02). `false` recusa toda chamada de IA com `503` sem `Retry-After` (decisão do operador, não janela de cota) — resto do sistema intacto. |
| `GEMINI_GLOBAL_REQUESTS_PER_DAY` | não | `18` | Teto interno de requisições/dia, escopo global (P4-02, D8). Faixa 1–20 — nunca configurável igual ou acima do RPD real do provedor (20, lido no AI Studio). O teto global sempre prevalece sobre o de usuário. |
| `GEMINI_USER_REQUESTS_PER_DAY` | não | `5` | Teto interno de requisições/dia por usuário (P4-02, D8) — mecanismo anti-monopolização da cota compartilhada, não uma reserva individual garantida. Faixa 1–20. |

---

## Testes

* **`npm test`** — suíte unitária (Vitest), dublês in-memory, sem rede nem Postgres real.
* **`npm run test:integration:postgres:docker`** — sobe um PostgreSQL 16 efêmero via Docker Compose, aplica as migrations do zero, roda os testes de integração real (transação, rollback, concorrência, constraints, idempotência) e desmonta tudo no final.
* **`npm run lint`** — ESLint (`typescript-eslint`, sem type-checking completo para evitar ruído em dublês de teste) com duas regras type-aware ligadas deliberadamente: `no-floating-promises` e `no-misused-promises` — a classe exata de defeito que já derrubou o processo em produção antes da correção.
* **`npm run typecheck`**, **`npm run build`**, **`npm run prisma:validate`**, **`npm run verify:production`** completam o Definition of Done local.

---

## Decisões arquiteturais deliberadas

* **Sem container de injeção de dependência.** A composição de dependências é feita manualmente em `src/routes.ts`. O projeto é pequeno o suficiente para que um container adicione indireção sem benefício claro.
* **Sem camada de `entities/`.** As regras de domínio que existem (CNPJ, coerência do DANFE) são funções puras em `src/domain/`; não há necessidade de objetos de entidade com identidade própria além do que os tipos de repositório (`IProduct`, `ICompany`, etc.) já expressam.
* **Match incerto nunca entra direto no estoque.** Toda sugestão de similaridade da IA fica pendente até confirmação humana — não existe caminho de código que aplique uma sugestão automaticamente, mesmo com confiança alta.
* **Indisponibilidade da IA nunca vira decisão de domínio.** O resultado da similaridade é uma união discriminada de três estados, e não `null`, justamente para que o compilador impeça `unavailable` de ser lido como `no_match`. Uma falha de transporte não pode criar produto no catálogo do cliente.
* **Auditoria não tem endpoint de leitura HTTP hoje.** `IAuditLogRepository.findByCompanyId`/`findByUserId` existem, são testados e indexados, mas não há rota que os exponha — decisão deliberada de manter o escopo da API restrito ao fluxo operacional até haver necessidade real de um endpoint de auditoria.
* **`AuditLog` não tem política de retenção automática.** Decisão conservadora: nenhuma exclusão automática até haver requisito legal/de negócio definido para o prazo de guarda de dado fiscal.
* **`prisma.config.ts` não importa `src/config/env.ts`.** Faria o carregamento do módulo disparar `createEnv(process.env)` inteiro — exigindo `JWT_SECRET` e `GEMINI_API_KEY` só para rodar `prisma migrate`/`validate`/`generate` (P5-01). `resolveDatabaseUrl` (`src/config/database-url.ts`) lê e valida só `DATABASE_URL`.
* **`429` do Gemini nunca dispara retry (P4-02).** Não há como distinguir de forma confiável, no status/corpo da resposta, throttling de janela curta (retry ajudaria) de cota diária esgotada (retry só queima mais uma requisição da cota compartilhada). Comportamento conservador deliberado: nunca repetir `429`; `500`/`503`/erros de rede continuam com retry normal.
* **Tokens não têm teto interno no Modo A (D8), só requisições.** O AI Studio publica RPM/TPM/RPD para `gemini-2.5-flash`, mas não publica um TPD equivalente — não há de onde derivar um teto diário de tokens sem inventar uma fórmula de conversão. `ai_usage_ledger` já acumula `spentTokens`/`spentCostUsdNanos` sem impor limite, pronto para uma decisão futura com telemetria real do piloto; nenhum número foi inventado nem derivado de TPM.
* **Artefatos de build (`.js`/`.d.ts`) são commitados junto do `.ts`.** Os testes importam por caminho `.js` (convenção `nodenext`); rode `npm run build` após editar `.ts` **antes de commitar** — ou o Vitest pode resolver o arquivo compilado desatualizado em vez do fonte, e o CI recusa o merge (`npm run verify:artifacts`, P5-06): o guard roda o build a partir do checkout limpo e falha se ele sujar qualquer artefato versionado, usando `git status --porcelain` como fonte de verdade em vez de uma lista manual de arquivos.

## Limitações conhecidas

* Não há Dockerfile de produção — o build de produção é validado no CI instalando só `dependencies`, mas não há imagem publicada.
* A otimização de lote da chamada de similaridade (M5-02 do backlog) está bloqueada por ausência de dado real de uso — o sistema ainda não foi implantado em produção.
* `TRUST_PROXY_HOPS` e `CORS_ALLOWED_ORIGINS` têm defaults seguros para instância única sem proxy; ajustar antes de colocar atrás de load balancer/CDN.

---

## Executando localmente

```bash
npm ci
cp .env.example .env   # preencher DATABASE_URL, JWT_SECRET (>= 32 caracteres, ex.: `openssl rand -base64 48`), GEMINI_API_KEY, INVITE_CODE (>= 8 caracteres)
npm run prisma:generate
npm run dev             # tsx watch, recarrega em mudanças
```

Para rodar a suíte de integração contra Postgres real é necessário Docker (`docker-compose.test.yml` sobe um banco efêmero isolado, nunca a `DATABASE_URL` de desenvolvimento).

---

## Deploy (Render + Neon)

**Status: primeiro deploy real tentado em 2026-09-02 e FALHOU no build** (`tsc` — `TS2305`, módulo `@prisma/client` sem os membros gerados do schema). **Causa raiz confirmada por reprodução em checkout limpo:** o build command documentado nunca executava `prisma generate`; sem isso, `@prisma/client` é só o pacote-placeholder (`export * from '.prisma/client/default'`), sem `PrismaClient`/`Prisma`/os tipos de modelo. Corrigido nesta rodada — ver `npm run render:build` abaixo — mas **o deploy no Render ainda não foi reexecutado com a correção**; nenhuma das afirmações abaixo foi verificada contra o ambiente real além do próprio build/migration.

* **Sem Dockerfile.** O runtime nativo Node do Render usa build/start commands; `npm prune --omit=dev` + `verify:production` já validam o grafo de produção no CI. Um Dockerfile acrescentaria superfície sem resolver nada que o runtime nativo não resolva — revisitar só se o build vier a exigir binário de sistema.
* **Build command:** `npm ci && npm run render:build` (equivalente a `npm ci && npm run prisma:generate && npm run build && npx prisma migrate deploy` — `prisma generate` precisa rodar **antes** de `tsc`, nunca implícito em `npm ci`: não há `postinstall`/`prepare` neste projeto, por decisão deliberada, para não exigir `DATABASE_URL` em todo `npm install`). Guardado contra regressão por um job de CI dedicado (`render-build-command`, ver `.github/workflows/ci.yml`) que roda esse exato comando a partir de um checkout novo, contra Postgres efêmero.
* **Start command:** `DATABASE_URL=$DATABASE_URL_POOLED npm start` — reatribui `DATABASE_URL` só para o processo em execução; a variável `DATABASE_URL` configurada no painel do Render permanece a *direta* (usada pelo build/migration acima).
* **Migration no build, não em Pre-Deploy Command** (exclusivo de planos pagos no Render). Efeito: `prisma` existe no momento do build (antes do `npm prune`), o que resolve o problema de empacotamento sem exigir Dockerfile — mas a migration roda **antes** da nova versão entrar em tráfego e **não é desfeita por rollback**.
* **Política expand/contract é obrigatória, não recomendada**, por causa do ponto acima: toda migration precisa ser compatível com a versão anterior da aplicação, porque essa versão pode voltar a rodar contra o schema novo após um rollback. Verificado: nenhuma das migrations existentes viola isso.
* **`prisma.config.ts` só exige `DATABASE_URL`** (não `JWT_SECRET`/`GEMINI_API_KEY`) — decoupling deliberado de `src/config/env.ts`, cujo carregamento do módulo dispara a validação completa do ambiente. Rodar uma migration nunca deveria exigir a chave do Gemini.
* **`DATABASE_URL`** (painel do Render) deve usar a string **direta** do Neon (sem `-pooler`), com `sslmode=require` — `prisma migrate deploy` precisa de semântica de sessão/lock que um pooler em modo transação pode quebrar. **`DATABASE_URL_POOLED`** (variável separada, também no painel) usa a string com sufixo `-pooler`, e só chega à aplicação em runtime via o Start Command acima — o build/migration nunca a vê.
* Segredos (`JWT_SECRET`, `GEMINI_API_KEY`, `INVITE_CODE`) vão **só** no painel do Render — nenhum em arquivo versionado.

Fora de escopo desta preparação: provisionar a conta Render/Neon, o primeiro deploy real, e a verificação empírica de `/health`/`SIGTERM` contra o ambiente real — isso é o restante de P5-01 e depende de acesso à conta, não de código.
