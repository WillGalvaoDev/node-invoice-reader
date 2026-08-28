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
| `POST` | `/users` | pública, rate limit 5/hora por IP | Cadastro de usuário. Senha com Argon2. |
| `POST` | `/login` | pública, rate limit 10/15min por IP | Autenticação; devolve JWT. |
| `POST` | `/companies` | Bearer JWT | Cria empresa + estoque principal em uma transação atômica. |
| `GET`  | `/companies` | Bearer JWT | Lista paginada (cursor) das empresas acessíveis ao usuário — owned e onde ele é colaborador —, com o papel (`OWNER`/`COLLABORATOR`) de cada uma. |
| `GET`  | `/companies/:companyId/stocks` | Bearer JWT | Lista paginada (cursor) dos estoques visíveis da empresa. Owner vê todos; colaborador só os que têm `StockPermission.canView = true`. `404` (sem distinguir "não existe" de "sem acesso") se o usuário não tiver nenhuma relação com a empresa. |
| `GET`  | `/products` | Bearer JWT | Lista paginada (cursor) por `stockId`. Exige acesso ao estoque. |
| `POST` | `/invoices/upload` | Bearer JWT, rate limit 5/min por usuário | Upload de DANFE (JPEG/PNG/PDF, até 10 MiB). Dispara o pipeline completo. `503` se o matching ficar indisponível — nada é gravado e a nota pode ser reenviada. |
| `GET`  | `/stocks/:stockId/suggestions` | Bearer JWT | Lista sugestões de produto pendentes do estoque. |
| `POST` | `/suggestions/:suggestionId/confirm` | Bearer JWT | Confirma uma sugestão: aplica a entrada no produto sugerido. |
| `POST` | `/suggestions/:suggestionId/reject` | Bearer JWT | Rejeita uma sugestão: cadastra o item como produto novo. |

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

Um único `PrismaClient`/`Pool` (`src/infra/prisma.ts`, `max: 10`) compartilhado por todos os repositórios — não há uma pool por repositório. Migrations em `prisma/migrations/`, aplicadas com `prisma migrate deploy`; nenhuma migration histórica é editada. Índices compostos cobrem as consultas reais paginadas/de auditoria (`products(stockId, createdAt, id)`, `audit_logs(companyId, createdAt)`, `audit_logs(userId, createdAt)`).

### Observabilidade

* **Logger estruturado** (`src/infra/logger.ts`) em JSON, com `redact` recursivo de senha/hash/token/Authorization/API key, e `requestId` de correlação em toda resposta (`X-Request-Id`).
* **Auditoria de domínio** (`AuditLog`) registra criação/atualização de produto, criação de empresa, tentativa de acesso não autorizado e decisão de sugestão, com `previousState`/`newState`. Best-effort: falha ao gravar auditoria nunca reverte uma operação já persistida.
* **Telemetria de IA** (`src/infra/ai-telemetry.ts`) registra, por chamada ao Gemini, duração monotônica, tentativas, tokens reais (nunca estimados), custo em nanoUSD e categoria de falha; e por sugestão, decisão e faixa de confiança.

### Operação

* **Graceful shutdown**: `SIGTERM`/`SIGINT` drenam requisições em voo, encerram o pool do Postgres e saem com código 0; timeout configurável força o fechamento e sai com código 1.
* **`unhandledRejection`/`uncaughtException`** são logados com contexto seguro e disparam o mesmo shutdown fatal.
* **CI** (`.github/workflows/ci.yml`, GitHub Actions, `ubuntu-latest`): `prisma validate` → `prisma generate` → `typecheck` → `lint` → suíte unitária → gate de integração PostgreSQL real (Docker); job separado valida o build de produção com **apenas** `dependencies` instaladas (`npm prune --omit=dev`) e roda `scripts/verify-production-runtime.mjs`, que importa o grafo de dependências real do artefato compilado.

---

## Variáveis de ambiente

Ver `.env.example`. Todas são validadas e falham rápido no boot (`src/config/env.ts`) — nenhuma tem fallback silencioso além dos defaults documentados.

| Variável | Obrigatória | Default | Descrição |
|---|---|---|---|
| `DATABASE_URL` | sim | — | Postgres. |
| `JWT_SECRET` | sim | — | Assinatura dos tokens (HS256). Mínimo de **32 caracteres** — o boot falha abaixo disso. Gerar com `openssl rand -base64 48`. |
| `GEMINI_API_KEY` | sim | — | Google Gemini. |
| `PORT` | não | `3333` | Porta HTTP. |
| `TRUST_PROXY_HOPS` | não | `0` | Número exato de proxies reversos confiáveis (0–10). Só alterar se a API estiver atrás de proxy conhecido. |
| `CORS_ALLOWED_ORIGINS` | não | vazio | Allowlist HTTP(S) separada por vírgula. Sem wildcard, sem credenciais. |
| `REQUEST_TIMEOUT_MS` | não | `120000` | Timeout de requisição do servidor HTTP. |
| `SHUTDOWN_TIMEOUT_MS` | não | `30000` | Prazo do graceful shutdown antes de forçar. |
| `GEMINI_TIMEOUT_MS` | não | `30000` | Timeout por tentativa ao Gemini. |
| `GEMINI_MAX_ATTEMPTS` | não | `2` | Tentativas totais (1–2) para erro transitório. |
| `SIMILARITY_CONFIDENCE_THRESHOLD` | não | `0.7` | Limiar de confiança do matching por similaridade (0–1). Fonte única usada no prompt e no código — não alterar sem dado real de uso. |

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
* **Artefatos de build (`.js`/`.d.ts`) são commitados junto do `.ts`.** Os testes importam por caminho `.js` (convenção `nodenext`); rode `npm run build` após editar `.ts` antes de rodar a suíte, ou o Vitest pode resolver o arquivo compilado desatualizado em vez do fonte.

## Limitações conhecidas

* Não há Dockerfile de produção — o build de produção é validado no CI instalando só `dependencies`, mas não há imagem publicada.
* A otimização de lote da chamada de similaridade (M5-02 do backlog) está bloqueada por ausência de dado real de uso — o sistema ainda não foi implantado em produção.
* `TRUST_PROXY_HOPS` e `CORS_ALLOWED_ORIGINS` têm defaults seguros para instância única sem proxy; ajustar antes de colocar atrás de load balancer/CDN.

---

## Executando localmente

```bash
npm ci
cp .env.example .env   # preencher DATABASE_URL, JWT_SECRET (>= 32 caracteres, ex.: `openssl rand -base64 48`), GEMINI_API_KEY
npm run prisma:generate
npm run dev             # tsx watch, recarrega em mudanças
```

Para rodar a suíte de integração contra Postgres real é necessário Docker (`docker-compose.test.yml` sobe um banco efêmero isolado, nunca a `DATABASE_URL` de desenvolvimento).
