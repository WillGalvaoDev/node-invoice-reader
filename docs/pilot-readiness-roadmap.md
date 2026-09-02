# Pilot Readiness Roadmap — DocScan

**Natureza:** originalmente documento de análise e planejamento (r1–r3). A partir de r4, também registra o status real de execução das tarefas à medida que são implementadas — ver §17 e o status de cada tarefa concluída.
**Fonte de verdade desta análise:** o código-fonte em `HEAD` (`9a5a7a6`), lido diretamente. Onde a documentação existente diverge do código, o código prevalece e a divergência está registrada.
**Relação com o backlog anterior:** este roadmap é **separado** de `docs/backlog-engenharia.md` (M1–M6). Não renumera, não reabre e não substitui aquelas tarefas. Duas pendências de lá (M5-02 e as bandas de decisão de M6-02) têm aqui uma estratégia explícita de desbloqueio.

**Histórico de revisões**

| Rev. | Alteração |
|---|---|
| r1 | Versão inicial: 20 tarefas, P0–P6. |
| **r2** | **(a)** Falha de similaridade promovida de risco observado para correção obrigatória pré-piloto (**P0-02**, bloqueia P6-01). **(b)** Contabilidade de gasto separada da observabilidade: **AI Budget Ledger** (autoritativo, escrita forte, fail-closed) deixa de depender do **AI Call Events** (best-effort), com reconciliação periódica (**P3-04**). **(c)** Revogação de token migrada de `passwordChangedAt` × `JWT.iat` para **`authVersion`** inteiro no JWT. Consequência: 22 tarefas e **o caminho crítico muda** — ver §8. |
| **r3** | Decisões humanas de P0-01 aprovadas e incorporadas: **Render Free** + **Neon Free** + **sem frontend** + **cadastro por código de convite** + **Gemini Free Tier, paid budget USD 0**. P5 deixa de tratar plataforma como abstração. **O ledger muda de natureza** — de orçamento em USD para **cota de uso** (requests/tokens), preservando integralmente o contrato da r2. Kill switch separado do orçamento (`GEMINI_ENABLED`). **Uma incompatibilidade material encontrada e escalada** — ver §13-A. Contagem de tarefas inalterada: 22. |
| **r4** | **§13-A RESOLVIDA.** Free Tier passa a ser o tier de **desenvolvimento privado**; **Paid Tier é gate operacional antes do piloto externo com DANFE real**. Consequências: P4-02 desenhado para **dois modos** (A free / B paid) com o mesmo mecanismo; P3 e P3-04 preparados para os dois estágios; novo **gate REAL-DOCUMENT AI TIER** antes de P6-01. Custo variável de IA passa a ser aceito a partir do piloto real; R$ 0 fixo permanece para Render + Neon. **P0-02 implementada e commitada** (`cfa6ca3`, TDD completo, 303/303 + Gate 31/31). |
| **r5** | **P1-01 implementada e commitada** (`d02236e`). `GET /companies` com discovery por owner+colaborador, `role` derivado sem query extra, paginação por cursor no padrão de `/products`. `findByOwnerId` (sem chamador) removido em favor de `findAccessibleById`/`findAccessiblePageByUserId`. Suíte 303 → 315; Gate 31 → 33, com prova de ausência de N+1. |
| **r6** | **P1-02 implementada e commitada** (`de36707`). `GET /companies/:companyId/stocks`. `company access ≠ stock access`: gate de existência via `ICompanyRepository.findAccessibleById` (P1-01, 404 anti-enumeration), listagem via `IStockRepository.findViewablePageByCompanyId` — owner vê tudo sem depender de `StockPermission`, colaborador só `canView=true`. Cursor validado por reuso de `findByIdForViewer` (sem duplicar autorização). Paginação por cursor adotada por consistência com `/companies` e `/products`, **superando a nota "sem paginação" do rascunho original de P1-02** — ver a tarefa para a justificativa. `findByCompanyId` (sem chamador) removido. Suíte 315 → 330; Gate 33 → 37, com prova de ausência de N+1. **Discovery mínimo Company → Stock completo** — ver §17. |
| **r7** | **P2-01 implementada e commitada** (`a1b2c0c`). `JWT_SECRET` passa a exigir mínimo de 32 caracteres em `createEnv`, fail-fast, sem vazar o valor na mensagem de erro. Segredos sintéticos de CI/integração ajustados para o novo mínimo. Suíte 330 → 336. |
| **r8** | **P5-06 implementada e commitada** (`980624e`). Guard de artefato compilado no CI (`npm run verify:artifacts`, `scripts/verify-build-artifacts.mjs`): roda `npm run build` a partir do checkout limpo e falha se `git status --porcelain` reportar qualquer divergência — Git como fonte de verdade, sem lista manual de extensões. RED/GREEN provado com edição deliberada de `trust-proxy.ts` sem rebuild. |
| **r9** | **P0-01 CONCLUÍDA (2026-08-28).** As sete decisões humanas restantes (D1–D7) tomadas pelo responsável do projeto e registradas em `docs/pilot-decisions.md`: máximo de 100 itens/DANFE (D1, destrava P4-01); retenção de `ai_call_events` em 60 dias (D2, destrava parte de P3-03); password management — troca **e** recuperação por e-mail — como Must have pré-piloto (D3, reclassifica P2-02, cria **P2-03** bloqueada pela escolha ainda não feita de provedor de e-mail); Gemini Free Tier no piloto sem budget USD arbitrário, Paid Tier comercial `DEFERRED_WITH_GATE` até valores explícitos (D4); teto de 200 usuários, não meta (D5); janela de 4 semanas (D6); `AuditLog` sem purga durante o piloto, prazo legal/comercial definitivo `DEFERRED_WITH_GATE` antes da comercialização, sem número inventado (D7). Duas tarefas novas de governança criadas a partir de investigação read-only de `AuditLog`: **P3-00A** (cobertura de auditoria de confirm/reject de sugestão, *Should have*) e **P3-00B** (barreira estrutural de payload do `AuditLog`, *Should have*, recomendada junto de P2-02). §14 reordenada. Nenhum código alterado nesta rodada — governança e documentação apenas. |
| **r10** | **P3-00B implementada e commitada** (`09d4525`). Barreira estrutural do `AuditLog` em duas camadas: `AuditLogWrite` *branded* (só os builders de `use-cases/audit-events.ts` o produzem, então objeto literal não compila) e `assertAuditLogWrite` como rede de runtime, exercida pelo repositório Prisma **e** pelo dublê in-memory. Whitelist positiva de chaves **por evento**; `details` fora da escrita (coluna e leitura preservadas); `productAuditState` absorvido pelo builder. **`SENSITIVE_KEYS` do logger avaliada e descartada como fronteira primária** — comprovadamente deixa passar `currentPassword`/`newPassword`/`recoveryCode`, os nomes de P2-02/P2-03. Recusar, não mascarar; best-effort preservado. Suíte 336 → 388; Gate 33 → 37. Nenhuma migration. |
| **r11** | **P2-02 implementada e commitada** (`133d89a`). `PATCH /me/password` com `authVersion Int @default(1)` (migration `20260828150000_add_user_auth_version`) comparado, não `passwordChangedAt`/`iat` — revogação por igualdade de inteiros, provada determinística sem avanço de relógio. `JoseTokenProvider.verifyToken` passa a validar tipo/presença da claim (único ponto de validação); `IUserRepository.updatePassword` grava hash e incrementa `authVersion` num único `UPDATE`, atomicidade provada sob concorrência real no gate. Novo evento de auditoria `USER:UPDATE` (`{ authVersion }`, sem material de senha), usando a barreira de P3-00B. Suíte 388 → 408; Gate 37 → 39. |
| **r12** | **P4-01 implementada e commitada** (`b0eee66`). `DANFE_MAX_ITEMS=100` (D1) como fonte única entre `responseSchema.maxItems` do prompt e `.max()` do Zod (`createDanfeResponseSchema`, virou fábrica para não acoplar o schema a `env` no módulo). Excesso de itens vira 422 com mensagem específica (distinta de "DANFE malformado"), detectado pelo `code: 'too_big'` do próprio Zod — abortando antes de qualquer chamada de similaridade. Suíte 408 → 418; Gate 39/39 (sem regressão, tarefa não toca persistência). |
| **r13** | **P5-01 parcialmente preparada e commitada** (`08f49bc`) — **não concluída**. `prisma.config.ts` desacoplado de `env.ts` (`resolveDatabaseUrl`, novo, `src/config/database-url.ts`): `prisma migrate`/`validate`/`generate` deixam de exigir `JWT_SECRET`/`GEMINI_API_KEY`, verificado na prática com as variáveis removidas do ambiente. Build/start commands e política expand/contract documentados no README. **Deploy real, `prisma migrate status` contra Neon e `/health`/`SIGTERM` contra Render seguem pendentes — exigem conta e credenciais reais, fora do alcance de execução autônoma.** Suíte 418 → 422. |
| **r14** | **P4-02 avaliada e classificada `HUMAN_DECISION_REQUIRED`** — nenhum código escrito. Ao revisar o design antes de implementar, confirmou-se que a própria tarefa já exigia ler limites reais de cota no Google AI Studio para calibrar os tetos internos do Modo A ("Não fixei número" já estava registrado) — acesso a conta externa, mesma classe de bloqueio de P5-01. **P4-03 implementada** (não commitada nesta rodada). Código de convite compartilhado via `INVITE_CODE`, comparado por `timingSafeEqual` sobre digests SHA-256 (evita a exigência de mesmo comprimento do `timingSafeEqual` cru); ausência e código incorreto convergem no mesmo `403`. Rate limit por usuário em `POST /companies`. **Achado corrigido:** CI/scripts não definiam `INVITE_CODE` — mascarado localmente pelo `.env` via dotenv; confirmado ocultando o `.env` temporariamente e corrigido nos dois jobs do CI e nos dois scripts de runtime. Suíte 422 → 432; Gate 39/39. |
| **r15** | **P3-01 implementada e commitada.** Nova tabela `ai_call_events` (migration `20260902120000_add_ai_call_events`, aditiva: tabela nova + `ProcessedInvoice.correlationId` nullable). `correlationId` (UUID) gerado no servidor em `ReadInvoiceUseCase.execute`, nunca aceito do cliente — propagado a `extractDanfeData`/`findSimilarProduct` via `IAiCallContext` e à persistência da nota na mesma transação. Nova `PrismaAiTelemetry` (implementa `IAiTelemetry`) persiste cada chamada real ao Gemini, mantendo o log estruturado como canal secundário; `estimatedCostUsdNanos` substitui `costUsdNanos` no tipo do evento (estimado, nunca faturado — D4). `userId`/`companyId`/`stockId` vão para a tabela mas são **excluídos** do canal de log (whitelist positiva, mesmo princípio de P3-00B). Escrita best-effort e fora da transação de domínio, provada com falha síncrona e assíncrona do recorder. Nenhum caminho de código lê `ai_call_events` para autorizar chamada de IA (verificado por grep, critério de aceite 7). Sem FK para User/Company/Stock (decisão deliberada: tabela best-effort de alto volume, sem consulta desta tarefa via relação Prisma). Suíte 432 → 441; Gate 39 → 41. |
| **r16** | **P3-00A implementada e commitada.** `ConfirmProductSuggestionUseCase`/`RejectProductSuggestionUseCase` passam a auditar a alteração real do produto (`auditEvents.productSuggestionDecided`, novo builder — mesma forma de `productEntry`, descrição própria, não "processado por invoice"). `IProductSuggestionRepository.confirm`/`.reject` passam a devolver `{ suggestion, productId, previousProduct, nextProduct }` (a transação já tinha o antes/depois; só não saía dela) — contrato HTTP de `/suggestions/:id/confirm`|`/reject` **inalterado**, o use case continua devolvendo só `suggestion`. `authorizeProductSuggestion` passa a devolver também `companyId` (valor já resolvido e antes descartado). Sem migration — `PRODUCT:CREATE`/`PRODUCT:UPDATE` já estavam na whitelist de P3-00B. Provado com dado real no gate (audit log real após confirm/reject via Prisma, não só dublê). Suíte 441 → 445; Gate 41/41 (sem regressão). |
| **r17** | **P3-02 implementada e commitada — como VIEW, não tabela.** Critério de aceite 1 (avaliar view × tabela) resolveu a favor da view: todo o dado (`confidence` bruta, `status`, `decidedAt`, `decidedByUserId`, `stockId`) já existe em `product_similarity_suggestions`, e `correlationId` já chega via `ProcessedInvoice` (P3-01). `ai_suggestion_events` (migration `20260902130000_add_ai_suggestion_events_view`) expande cada sugestão em um evento `created` e, se decidida, um segundo `confirmed`/`rejected`, via `UNION ALL`. Sem escrita própria — o critério "falha de registro não reverte a decisão" fica automaticamente satisfeito, por não existir registro separado. `confidenceBucket` nunca persistido — bucket calculado na consulta, provado com uma agregação real de taxa de aceitação por faixa no gate. Nenhum código de aplicação alterado (nenhuma tabela, nenhum repositório, nenhuma mudança em `IAiTelemetry`). Suíte inalterada (445/445, mudança é só SQL); Gate 41 → 42. |
| **r18** | **P3-03 implementada e commitada.** `docs/telemetry-runbook.md` com as 8 consultas nomeadas (latência, tokens/nota, custo/nota, custo diário+acumulado do mês, taxa de falha, distribuição de confidence, aceitação por faixa, chamadas de similaridade/nota), cada uma testada contra dado semeado real no gate. Retenção de `ai_call_events` (D2: 60 dias) como script de operador (`scripts/purge-ai-call-events.mjs`, `npm run retention:ai-call-events`) — sem scheduler (Render Free não oferece cron/one-off jobs), idempotente, toca só uma tabela por construção. Provado: não afeta `AuditLog` (linha antiga semeada, intocada após duas execuções); segunda execução remove 0 linhas. Nenhuma migration — reaproveita `ai_call_events`/`ai_suggestion_events` de P3-01/P3-02. Suíte 445/445 (inalterada); Gate 42 → 51. |
| **r19** | **P3-04 avaliada e classificada `SKIPPED_BLOCKED`** — nenhum código escrito. `ai_usage_ledger` não existe (confirmado por leitura de `prisma/schema.prisma`): P4-02, que a cria, segue bloqueada pela mesma decisão humana de limites reais do Gemini (RPM/TPM/RPD), ainda não registrada em `docs/pilot-decisions.md`. Cadeia transitiva confirmada e registrada: **P5-05** (exige a reconciliação de P3-04, e P5-03/P5-04, que exigem a conta Render+Neon de P5-01), **P6-01/P6-02/P6-03** (P6-01 exige P2-03, bloqueada pela escolha de provedor de e-mail) — todo o restante de §14 depende de um dos três blockers humanos já conhecidos (P2-03, P4-02, P5-01). Nenhuma tarefa independente restante encontrada nesta rodada. Nenhum código alterado — governança e documentação apenas. |
| **r20** | **P4-02 implementada e commitada — Modo A completo, D8 (`docs/pilot-decisions.md`).** Evidência humana do AI Studio para `gemini-2.5-flash`: RPM=5, TPM=250k, RPD=20, **TPD não publicado** (registrado como ausência de dado, nunca derivado). Tetos internos de requisições: **18/dia global, 5/dia por usuário** — o global sempre prevalece; 5/usuário é anti-monopolização, não reserva (200 usuários ≠ 1000 requests). **Tokens deliberadamente sem teto** nesta primeira configuração — ausência de base empírica (piloto não iniciado, dado de gate é sintético e descartado) e ausência de TPD publicado; `ai_usage_ledger` já acumula `spentTokens`/`spentCostUsdNanos` desde já, sem teto, pronto para uma decisão futura com dado real. Nova tabela `ai_usage_ledger` (migration `20260903090000_add_ai_usage_ledger`): reserva atômica global+usuário numa única transação Postgres (rollback nativo cobre "tudo ou nada" e "reserva liberada em erro" — sem decremento manual compensatório); reconciliação move reservado→gasto com tokens/custo reais. Fail-closed genuíno: falha do ledger nunca é best-effort, vira 503 antes de qualquer chamada ao Gemini. **`429` deixa de disparar retry** (critério 11) — não há forma confiável de distinguir throttling de janela curta de cota diária esgotada; comportamento conservador registrado. Kill switch (`GEMINI_ENABLED`) separado do teto. `GeminiQuotaExceededError`/`GeminiDisabledError` novos, com `Retry-After` correto no error handler. Suíte 471/471 (445 → 471); Gate 51 → 56 (concorrência real provada: duas reservas simultâneas no limite exato nunca produzem duas aceitas). |
| **r21** | **P3-04 implementada e commitada.** `scripts/reconcile-ai-usage.mjs` (`npm run reconcile:ai-usage`), somente leitura. **Achado do Design Review, antes de decidir a fórmula:** `ai_call_events` conta operações lógicas (uma linha por upload/similaridade), `ai_usage_ledger.spentRequests` conta tentativas HTTP — comparar `COUNT(eventos)` com `spentRequests` divergiria por construção a cada retry, sem ser perda nem anomalia; a grandeza comparável é `SUM(ai_call_events.attempts)`. **Segundo achado:** uma tentativa recusada por cota no meio de um retry incrementa esse contador antes de a reserva ser revertida — o guard funcionou, mas a telemetria ainda registrou a tentativa; o script trata essa diferença de 1 unidade como não-anomalia, citando a causa, em vez de alarme automático. Tolerância `max(1, 5%)` — o piso evita que, no volume do piloto (teto de 18/dia), qualquer perda isolada de telemetria vire falso positivo. Reserva residual sempre anômala, sem tolerância. Nenhuma migration — reaproveita `ai_usage_ledger`/`ai_call_events` de P4-02/P3-01. Suíte 471/471 (inalterada); Gate 56 → 69 (13 cenários de divergência, todos verdes no primeiro run). |
| **r22** | **Primeiro deploy real no Render (2026-09-02) FALHOU no build — causa raiz encontrada, reproduzida e corrigida; deploy ainda não reexecutado.** `tsc` falhava com `TS2305` (`@prisma/client` sem `PrismaClient`/`Prisma`/tipos de modelo) mais `TS7006` em cascata. **Causa:** o build command documentado (`npm ci && npm run build && npx prisma migrate deploy`) nunca rodava `prisma generate`; o CI sempre passou porque `verify`/`production-runtime` já tratavam `prisma:generate` como *step* próprio antes do build — nenhum job testava a *string* de comando literal que o Render de fato executa. **Reprodução real, sem tocar no workspace principal:** clone descartável em diretório temporário, `npm ci` + `npm run build` reproduziu a falha exata (mesmos `TS2305`); `npx prisma generate` + `npm run build` corrigiu (build limpo, exit 0). Verificado separadamente, só contra Postgres local efêmero (nunca o Neon real): `prisma migrate deploy` **independe** de `prisma generate` já ter rodado — a falha era só do build TypeScript. **Correção:** novo script `npm run render:build` (`prisma:generate && build && migrate deploy`) como fonte única, substituindo a string duplicada em README/roadmap; Build Command do Render passa a ser `npm ci && npm run render:build`. **Guarda de regressão:** novo job de CI `render-build-command` (`.github/workflows/ci.yml`) executa esse comando exato a partir de checkout novo, contra Postgres efêmero via `services:` — prova a ordem em ambiente limpo a cada push, não apenas checa texto de documentação. Nenhuma mudança em `DATABASE_URL` direta/*pooled*, na política expand/contract, ou em P5-02. Suíte 471/471 (inalterada); Gate 69/69 (inalterada) — a proteção nova é um job de CI, não um teste Vitest. |

---

## 1. Sumário executivo

O DocScan está tecnicamente saudável e funcionalmente incompleto **para uso real**. O pipeline de domínio (DANFE → extração → validação → matching → sugestão → upsert transacional → auditoria) está implementado, testado e defendido. O que falta não é domínio: é **operabilidade, contenção de custo, retenção de dado observável e um caminho de deploy**.

Seis conclusões que mudam a hipótese de roadmap apresentada:

1. **Há um defeito de correção no pipeline de IA que precede tudo o mais.** `findSimilarProduct` captura a falha do provedor e devolve `null` (`gemini-ai.provider.ts:346-349`), e o chamador lê `null` como "não há produto equivalente" e **cadastra um produto novo**. Indisponibilidade técnica do Gemini está sendo convertida em uma afirmação sobre o domínio. Correção é a prioridade 1 do `CLAUDE.md`, acima de tudo neste documento: isto é **P0-02**, obrigatório antes do piloto.
2. **O maior risco estrutural do piloto não é nenhuma das seis frentes propostas.** É a combinação `POST /users` público sem verificação + `POST /invoices/upload` sem teto de custo + número de itens por DANFE ilimitado. Um único usuário legítimo, dentro dos limites que a arquitetura hoje permite, pode gerar dezenas de milhares de chamadas Gemini por dia.
3. **A decisão de plataforma de deploy deve vir primeiro, não em quinto lugar.** Ela determina o valor de `TRUST_PROXY_HOPS`, a existência ou não de Dockerfile, o sink de logs, o mecanismo de backup e — indiretamente — a estratégia de telemetria. Colocá-la em P5 obriga a decidir P3 no escuro.
4. **Contabilidade de gasto e observabilidade são duas responsabilidades, não uma** — e ambas ficam em PostgreSQL, por razões diferentes. O **AI Budget Ledger** é autoritativo para autorizar gasto: escrita forte, **fail-closed**, falhou ⇒ o Gemini não é chamado. O **AI Call Events** é histórico: **best-effort**, falhou ⇒ a operação de negócio não é revertida. Fazer o guard de custo depender de uma escrita best-effort seria autorizar gasto sobre um registro que o próprio contrato permite perder. As duas convivem no mesmo banco justamente para que a reconciliação periódica seja uma consulta SQL.
5. **`PATCH /me/password` não é bloqueador de piloto fechado.** O bloqueador real que ele *não* resolve é: um usuário que esquece a senha hoje tem a conta irrecuperável (não há reset, não há admin). A entrega obrigatória é um caminho de recuperação operado (script + runbook), não um endpoint de troca de senha. A revogação de token que ele destrava usa **`authVersion` inteiro no JWT**, não comparação de relógio.
6. **`X-Request-Id` é aceito do cliente** (`src/middlewares/request-id.ts:8`). Usá-lo como chave de correlação de telemetria é inseguro: um cliente pode enviar o mesmo id em todas as requisições e colapsar toda a correlação de custo e de chamadas-por-nota. A correlação precisa de um identificador gerado no servidor.

Com a restruturação proposta, o caminho até "piloto real controlado" tem **22 tarefas**, estimadas em **19–30 dias úteis** de execução, mais uma janela de observação de piloto de **4 semanas** em calendário (D6).

**Acréscimo da r3 — as decisões de infraestrutura estão tomadas, e uma delas tem consequência não-óbvia.**

Render Free + Neon Free + Gemini Free Tier sustentam tecnicamente o piloto descrito, a custo fixo de R$ 0. As limitações são reais mas administráveis, e estão listadas em §5-A. Três consequências mudam o desenho:

1. **O guard de custo deixa de guardar dinheiro e passa a guardar cota.** Sem conta de faturamento vinculada, gasto pago é estruturalmente impossível — guardar dólares que não podem ser cobrados é guardar nada. Mas o recurso escasso não desapareceu, mudou de unidade: passou a ser **requisições e tokens por dia, compartilhados por toda a coorte**. Um participante que consuma a cota diária deixa os outros sem sistema. O ledger permanece, com o mesmo contrato da r2 — autoritativo, escrita forte, fail-closed —, medindo `requests` e `tokens` em vez de USD.
2. **Render Free não tem shell nem one-off jobs.** Os três scripts de operador previstos (recuperação de conta, purga de retenção, reconciliação) **não têm onde rodar na plataforma**. Rodam da máquina do operador contra a `DATABASE_URL` do Neon, que é acessível pela internet com TLS. Isso funciona, mas precisa estar escrito antes de alguém precisar dele às pressas.
3. **A janela de recuperação do Neon Free é de 6 horas**, não de dias. Isso é menor que o requisito implícito do roadmap e exige um `pg_dump` complementar — gratuito, mas manual. P5-03 foi ajustada em vez de relaxada.

**A incompatibilidade material levantada na r3 foi resolvida em r4.** A documentação de preços do Gemini declara, para o *free tier*, **"Content used to improve our products: `Yes`"** — contra `No` no tier pago —, e o piloto processa DANFEs reais de empresas reais. A resolução aprovada **separa os dois usos por tier**:

| Uso | Tier | Dado |
|---|---|---|
| Desenvolvimento privado e validação técnica | **Free Tier** | mocks, fixtures, documentos sintéticos |
| **Piloto externo com DANFE real** | **Paid Tier**, configurado **antes** da abertura | dado fiscal real de terceiros |

Isso resolve o problema na raiz em vez de administrá-lo: o dado sensível nunca transita sob os termos do free tier. O preço é que **custo de IA deixa de ser zero quando o piloto real começar** — aceito e registrado. O alvo de R$ 0 permanece para a **infraestrutura fixa** (Render Free + Neon Free); o Gemini passa a ser **custo variável, sujeito a budget guard**. A verificação de que o ambiente está no tier certo vira um gate operacional bloqueante antes de P6-01 (§P6-00) — e o que importa nele é o **billing do projeto da API efetivamente usado pelo backend**, não a existência de uma assinatura pessoal qualquer.

---

## 2. Estado atual reconstruído do código

### 2.1 Superfície HTTP completa (`src/routes.ts:79-86` + `src/app.ts:45`)

| Método | Rota | Auth | Rate limit | Observação |
|---|---|---|---|---|
| `GET` | `/health` | pública | **nenhum** | `SELECT 1` real no Postgres a cada chamada |
| `POST` | `/users` | pública | 5/h por IP | cadastro aberto, sem verificação de e-mail |
| `POST` | `/login` | pública | 10/15min por IP | devolve JWT de 1 dia |
| `POST` | `/companies` | Bearer | **nenhum** | cria empresa + `Estoque Principal` atomicamente |
| `GET` | `/products` | Bearer | nenhum | paginado por cursor, exige `canView` |
| `POST` | `/invoices/upload` | Bearer | 5/min por usuário | dispara todo o pipeline de IA |
| `GET` | `/stocks/:stockId/suggestions` | Bearer | nenhum | pendentes do estoque |
| `POST` | `/suggestions/:id/confirm` | Bearer | nenhum | **não chama IA** |
| `POST` | `/suggestions/:id/reject` | Bearer | nenhum | **não chama IA** |

**Nove rotas. Nenhuma delas lista empresas ou estoques.**

### 2.2 O que existe no schema mas não tem superfície HTTP

`CompanyCollaborator`, `StockPermission`, `AuditLog`, `ProcessedInvoice`. Nenhuma dessas entidades pode ser criada, lida ou modificada via API. Consequência prática, verificada: **não existe nenhum caminho de código que crie um `CompanyCollaborator`**. Toda autorização por colaborador (`findByIdForUser`/`findByIdForViewer`, `src/repositories/prisma-stock.repository.ts:38-83`) está implementada, testada e **inalcançável em produção**. Hoje, na prática, só o *owner* existe.

### 2.3 Métodos de repositório sem nenhum chamador em produção

Levantamento direto (`grep` excluindo `*.spec.ts`, `in-memory/`, `*.d.ts`):

| Método | Situação |
|---|---|
| `ICompanyRepository.findByOwnerId` | sem chamador — **candidato natural a virar a query de `GET /companies`** |
| `ICompanyRepository.create` | sem chamador (só `createWithDefaultStock` é usado) |
| `IStockRepository.create` | sem chamador |
| `IStockRepository.findByCompanyId` | sem chamador — **candidato a `GET /companies/:id/stocks`**, mas sem filtro de permissão |
| `IAuditLogRepository.findByCompanyId` / `findByUserId` | sem chamador (decisão documentada no README) |
| `IProductRepository.save` / `update` / `delete` | sem chamador (a persistência de nota usa `IInvoicePersistenceRepository`) |

Isso já responde parte da pergunta de P1: as duas queries de discovery **quase** existem. O que falta nelas é exatamente o que importa — o predicado de autorização.

### 2.4 Autenticação

- **JWT** HS256 via `jose`, expiração fixa **1 dia**, payload `{ sub, email }` (`src/providers/implementations/jose-token.provider.ts:18`).
- `JWT_SECRET` é validado apenas como **string não vazia** (`src/config/env.ts:81`). Não há mínimo de entropia. `JWT_SECRET=a` passa no boot.
- **Sem** refresh token, logout, revogação, `authVersion`/`tokenVersion`, troca de senha, reset por e-mail, verificação de e-mail, MFA, bloqueio por tentativas.
- **Há um ponto de alavancagem importante:** `ensureAuthenticated` já faz `userRepository.findById(decoded.sub)` **a cada requisição** (`src/middlewares/ensure-authenticated.ts:26`). Uma coluna de versão de credencial custa **zero round-trip adicional** para viabilizar revogação — o SELECT já acontece.
- `verifyToken` valida a assinatura e devolve apenas `{ sub, email }`, **descartando as demais claims** (`jose-token.provider.ts:22-37`). Qualquer mecanismo de revogação precisa que o payload devolvido cresça.
- Senha: Argon2id com **parâmetros default da biblioteca** (`src/providers/implementations/argon2-hash.provider.ts:7`). Política: 8–128 caracteres (`src/schemas/http.schemas.ts:5`), sem outra regra.
- Enumeração de contas: `/login` devolve mensagem genérica (bom). `/users` devolve **409 explícito** para e-mail duplicado — é enumeração por design, aceitável para cadastro, mas relevante se o cadastro público continuar aberto.
- Rate limiting é **em memória** (`express-rate-limit` default store). Correto para instância única; reinício zera as janelas.

### 2.5 Telemetria de IA — o que realmente existe

`src/infra/ai-telemetry.ts` faz **exatamente uma coisa**: chama `logger.info`, que escreve uma linha JSON em **stdout** (`src/infra/logger.ts:61-65`). Não há tabela, não há agregação, não há retenção, não há consulta. Instrumentação existe; **telemetria historicamente consultável não existe**.

Detalhamento por evento:

**`ai_operation`** (emitido em `src/providers/gemini-ai.provider.ts:270,273,327,347`) — campos: `requestId?`, `operation` (`invoice_extraction` | `product_similarity`), `model`, `modelVersion?`, `status`, `durationMs`, `attempts`, `inputTokens?`, `outputTokens?`, `totalTokens?`, `costUsdNanos?`, `failureCategory?`. Tokens vêm de `usageMetadata` real, nunca estimados. Custo é calculado por tabela de preço local (`MODEL_PRICING`, só `gemini-2.5-flash`).

**`ai_suggestion`** (emitido em `read-invoice.use-case.ts:222`, `confirm-*`, `reject-*`) — campos: **`decision` e `confidenceBucket`. Só isso.** Sem `requestId`, sem `stockId`, sem `suggestionId`, sem confidence bruta.

Consequências mensuradas contra as perguntas que o piloto precisa responder:

| Pergunta | Hoje é respondível? |
|---|---|
| latência avg/p95 por operation | **Dado existe** no evento, mas some com o buffer de stdout — não há retenção |
| tokens por nota | **Sim, em princípio** — via `requestId`, que é 1:1 com o upload |
| custo por nota / por dia | idem, com a mesma ressalva de retenção |
| failure rate | **Dado existe** (`status` + `failureCategory`) |
| distribuição de confidence | **Parcialmente** — só o bucket, nunca o valor bruto. Buckets são fixos e irreversíveis na emissão |
| confirmed/rejected | **Contagem sim; correlação não.** `ai_suggestion` não carrega nenhuma chave |
| `product_similarity` calls por nota | **Só via `requestId`** — e `requestId` é fornecível pelo cliente |

Três bloqueios concretos, portanto:

1. **Retenção zero.** stdout sem sink persistente = o dado existe por microssegundos.
2. **`requestId` é do cliente** (`request-id.ts:8`, aceito se casar com `/^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/`). Como chave de correlação de custo, é falsificável e colidível.
3. **`ai_suggestion` não é correlacionável com nada.** Não dá para ligar uma decisão humana à nota, ao estoque, à empresa nem à chamada de IA que a gerou.

Adicionalmente: `AuditLog` **não tem coluna `requestId`** (`prisma/schema.prisma:172-195`). Não existe hoje nenhuma chave de junção entre o log de IA (stdout) e as linhas de domínio (Postgres).

### 2.6 Custo de IA — risco estrutural, sem números inventados

Chamadas por upload, lendo `read-invoice.use-case.ts:138-211`:

```
1 × invoice_extraction
+ 1 × product_similarity  por item que (a) não casa por código exato E (b) tem ≥ 1 candidato
```

Cada chamada pode custar até `GEMINI_MAX_ATTEMPTS` (=2) tentativas HTTP.

Os limites que existem:

- upload: **5/min por usuário**;
- arquivo: **10 MiB**;
- candidatos por chamada de similaridade: **≤ 15** (`MAX_SIMILARITY_CANDIDATES`).

O limite que **não** existe:

- **número de itens por DANFE.** `danfeResponseSchema.products` é `z.array(...).min(1)` — **sem `.max()`** (`src/schemas/gemini.schemas.ts:34`). O `responseSchema` enviado ao Gemini também não limita o array.

**Pior comportamento permitido pela arquitetura hoje, sem violar nenhum limite:**

Um usuário autenticado envia 5 notas/minuto, 24h por dia = **7.200 uploads/dia**. Cada upload gera `1 + N` chamadas, onde `N` é o número de itens não-casados da nota — um valor que o *conteúdo do documento* controla, não o sistema. Com uma nota de 20 itens novos, isso é **151.200 chamadas Gemini por dia, por conta**. Não existe teto global, teto por usuário, teto por empresa, circuit breaker, nem qualquer forma de desligar a IA sem derrubar o serviço — `GEMINI_API_KEY` é obrigatória no boot (`env.ts:82`), então remover a chave é indisponibilidade total, não degradação.

Multiplicador: `POST /users` é público (5 contas/hora/IP) e `POST /companies` **não tem rate limit nenhum**; CNPJ só precisa passar no dígito verificador, que é trivialmente gerável. O limite "por usuário" é, portanto, contornável por criação de contas.

Detalhe que o guard precisará tratar: em chamada que **falha**, `usageMetadata` normalmente não vem — o custo real fica **subestimado**. E `calculateGeminiCostUsdNanos` devolve `undefined` para modelo sem preço cadastrado (`ai-telemetry.ts:52`): se o modelo mudar sem entrada em `MODEL_PRICING`, a contabilidade fica **silenciosamente cega**.

### 2.7 Deploy / runtime

**Já existe e funciona:**

- CI em `ubuntu-latest` (`.github/workflows/ci.yml`): `prisma validate` → `generate` → `typecheck` → `lint` → suíte → gate PostgreSQL real via Docker; job separado faz `build` + `npm prune --omit=dev` + `npm ls --omit=dev` + `verify:production`.
- Node fixado em `24` (`.nvmrc`), `engines: ">=24 <25"`.
- Graceful shutdown completo com drenagem, timeout e código de saída correto (`src/server-lifecycle.ts`).
- `unhandledRejection`/`uncaughtException` → shutdown fatal logado.
- `/health` com `SELECT 1` real e 503 durante shutdown.
- Config validada e fail-fast no boot (`src/config/env.ts`), sem fallback silencioso.
- Pool Postgres único, `max: 10`.

**Não existe:**

- Dockerfile, Procfile, `fly.toml`, `railway.json` — **nenhum artefato de deploy**.
- Ambiente de staging ou separação de ambientes.
- Qualquer configuração de backup.
- Sink de logs.

**Três obstáculos concretos de deploy que só aparecem lendo o código:**

1. **Migrations não rodam em imagem de produção.** `prisma` é `devDependency`. Após `npm prune --omit=dev`, `prisma migrate deploy` não existe.
2. **`prisma.config.ts` importa `./src/config/env.js`** (`prisma.config.ts:2`), que exige `DATABASE_URL`, `JWT_SECRET` **e `GEMINI_API_KEY`** presentes. Rodar migration exige injetar a chave do Gemini — acoplamento indesejado entre o passo de schema e o segredo do provedor de IA.
3. **`tsc` emite ao lado do fonte** (`tsconfig.json` com `outDir` comentado) e os `.js` estão **commitados**. `npm start` é `node src/index.js`. Um deploy que não reconstrói pode subir um artefato **obsoleto** sem nenhum sinal de erro — silencioso e correto-por-acidente.

Detalhe menor mas real: `multer` grava em `tmp/` relativo ao CWD (`src/middlewares/invoice-upload.ts:6`). Há **5 arquivos órfãos em `tmp/` no repositório de trabalho agora**. O `finally` do use case limpa o caminho feliz e o de erro; um crash no meio do pipeline deixa resíduo.

### 2.8 Durabilidade de dados

9 migrations em `prisma/migrations/`, nenhuma editada retroativamente. Nenhuma delas é destrutiva. Não há backup, não há restore, não há retenção definida (`AuditLog` cresce indefinidamente — decisão conservadora documentada e correta para dado fiscal). Não há estratégia de rollback de migration escrita em lugar nenhum.

### 2.9 Rede e segurança

- CORS: allowlist estrita, sem wildcard, sem credenciais, valida origem no boot (`env.ts:55-76`). **Default vazio** — e `origin === undefined` é permitido (`http-security.ts:18`), ou seja, clientes não-browser (curl/Postman) funcionam sem configuração alguma.
- `helmet` ativo, CSP desligada deliberadamente (API JSON).
- `TRUST_PROXY_HOPS` default `0`, faixa 0–10, sem `true` booleano (correto — evita confiar em XFF arbitrário).
- Segredos: `.env` no `.gitignore`; nenhum segredo real versionado (os do CI são literais de teste explicitamente marcados).
- Logger com `redact` recursivo de chaves sensíveis.
- **`/health` é público, sem rate limit, e toca o banco.** Com pool de 10 conexões, um flood não autenticado disputa conexões com tráfego real.

### 2.10 Semântica de resultado da similaridade — defeito de correção

`IAiProvider.findSimilarProduct` devolve `ISimilarityMatch | null`. Lendo `gemini-ai.provider.ts:278-350`, **seis** situações distintas produzem o mesmo `null`:

| # | Situação | O que realmente aconteceu |
|---|---|---|
| 1 | `existingProducts.length === 0` | não há contra o que comparar — nenhuma chamada é feita |
| 2 | `parsed.matchFound === false` | o modelo afirmou que não há equivalente |
| 3 | `parsed.confidence < SIMILARITY_CONFIDENCE_THRESHOLD` | o modelo afirmou equivalência sem confiança suficiente |
| 4 | `!candidateIds.has(parsed.matchedProductId)` | o modelo **alucinou** um id fora da lista fornecida |
| 5 | produto do id não encontrado na lista | idem, variante |
| 6 | **`catch (error)` → `return null`** (linhas 346-349) | **timeout, 5xx, 429 esgotado, JSON inválido, schema inválido — o provedor falhou** |

O chamador (`read-invoice.use-case.ts:170-211`) tem uma única bifurcação: se veio match, cria sugestão; **senão, cadastra o item como produto novo**. Logo, a linha 6 significa que **uma indisponibilidade do Gemini é convertida em uma afirmação sobre o domínio** — "este item não existe no estoque, cadastre-o". O resultado é um produto duplicado no catálogo, com saldo e custo próprios, sem sugestão pendente e **sem nenhum sinal para o usuário**.

Três observações que agravam:

1. **É silencioso nos dois canais.** O `AuditLog` registra `CREATE PRODUCT` normalmente (é indistinguível de um produto legitimamente novo) e a telemetria registra `product_similarity status=failure` num evento separado, sem ligação com o produto criado.
2. **É irreversível pelo usuário.** A nota é persistida e o `accessKey` consome a chave de idempotência; reenviar devolve `409`. Não há rota de exclusão ou fusão de produto. A correção exige SQL.
3. **Contradiz uma invariante declarada.** O `CLAUDE.md` estabelece que "toda decisão que possa alterar identidade de produtos deve permanecer determinística ou exigir confirmação humana", e o README afirma que match incerto nunca entra direto no estoque. Aqui, um **erro de transporte** cria identidade de produto sem confirmação humana. A invariante vale para o caminho de sucesso e vaza no caminho de falha.

O caso 4 (alucinação de id) merece nota à parte: a rejeição do id fora da lista é uma **defesa correta e necessária** contra prompt injection (M2-06), mas o resultado dela hoje também é "produto novo". O modelo afirmou que há equivalente; a única coisa que sabemos é que não podemos confiar na resposta. Isso não é evidência de que o item seja novo.

Isto é tratado por **P0-02**, e é a única tarefa deste roadmap classificada como correção de defeito e não como capacidade nova.

---

## 3. Gap analysis

### 3.1 API usability — o caminho do usuário quebra na segunda sessão

Caminho completo hoje, do zero:

```
POST /users → POST /login → POST /companies → (guarda o stockId da resposta) → POST /invoices/upload
```

Isso funciona **uma vez**. Na sessão seguinte:

```
POST /login → ??? 
```

Não há `GET /companies`, não há `GET /companies/:id/stocks`, não há `GET /stocks/:id`. O `stockId` aparece **exclusivamente** na resposta de `POST /companies` (`create-company.use-case.ts:75-78`). Se o cliente perdeu esse valor, ele **não pode recuperá-lo por nenhum caminho da API** — precisa de SQL. E ele também não pode recriar a empresa: o CNPJ é único e devolve 409.

**Todas as operações reais dependem de `stockId`:** `GET /products`, `POST /invoices/upload`, `GET /stocks/:id/suggestions`. `confirm`/`reject` dependem de `suggestionId`, que só é descoberto via `GET /stocks/:id/suggestions` — que depende de `stockId`. **O `stockId` é o gargalo único de todo o sistema, e não há como descobri-lo.**

Isto é o defeito mais barato e mais grave do conjunto: duas rotas de leitura.

**Owner vs. collaborator:** a semântica existe e é correta (`canView` para leitura, `canCreate` para escrita). Mas, como não há caminho que crie `CompanyCollaborator`, um colaborador **não pode existir**. Se pudesse, sem `GET /companies` ele estaria em situação pior que o owner: nunca teria visto a resposta de `POST /companies` e portanto nunca teria como descobrir nada.

**Endpoints mínimos que faltam para um cliente funcionar sem intervenção manual:** exatamente dois — `GET /companies` e `GET /companies/:companyId/stocks`. Verifiquei o resto do ciclo: com esses dois, o loop `login → empresa → estoque → listar produtos → subir nota → ver sugestões → confirmar/rejeitar` fecha inteiramente pela API. Nada mais é necessário. Um `GET /me` seria simetria: o JWT já carrega `sub` e `email`, e `GET /companies` já serve como sonda de validade do token.

### 3.2 Autenticação — o que é bloqueador e o que não é

**Substituído em 2026-08-28 por decisão humana explícita — D3 (`docs/pilot-decisions.md`).** A tabela e a argumentação abaixo eram a recomendação deste roadmap antes de D3; preservadas como registro do que foi recomendado e por quê, mas **não valem mais como classificação vigente**. O responsável humano do piloto decidiu que **troca de senha autenticada (P2-02) e recuperação por e-mail (P2-03) entram como requisito antes do piloto**, revertendo as duas linhas marcadas abaixo. A única parte que D3 não altera é a entropia de `JWT_SECRET` (já resolvida, P2-01 concluída).

| Item | Piloto fechado — recomendação original (superada) | Piloto fechado — decisão vigente (D3) |
|---|---|---|
| Login + JWT 1d | já atende | já atende |
| Entropia mínima de `JWT_SECRET` | necessário | necessário — ✅ concluído (P2-01) |
| Troca de senha autenticada | desejável (*Should have*) | **necessário — Must have (D3)**, ver P2-02 |
| Recuperação de senha por e-mail | não necessário | **necessário — Must have (D3)**, ver P2-03 (bloqueada pela escolha de provedor de e-mail) |
| Caminho de recuperação de conta travada | necessário (pode ser runbook) | necessário (runbook de P5-05 continua existindo como caminho de operador, agora complementar ao autosserviço de P2-03) |
| Revogação/logout | desejável, acoplado à troca de senha | acoplado à troca de senha (P2-02), via `authVersion` |
| Verificação de e-mail | não necessário (coorte conhecida) | não alterado por D3 — segue não necessário |
| Rate limit de login | já atende | já atende |
| Enumeração via `/users` 409 | aceitável | não alterado por D3 |

**Registro da recomendação original (superada), preservado para rastreabilidade.** Este roadmap recomendava não construir reset por e-mail no piloto fechado: um subsistema inteiro (provedor, domínio verificado, template, tokens de uso único, rate limit, antienumeração) para uma coorte pequena e nominalmente conhecida, quando um script de operador resolveria conta travada em minutos. O responsável humano avaliou o mesmo trade-off e decidiu diferente — priorizar autosserviço mesmo com o custo de um subsistema novo e a dependência (ainda em aberto) de escolher um provedor de e-mail. Essa é uma decisão de produto legítima que este roadmap não deve contestar depois de tomada; **D3 é agora a fonte de verdade**, não esta seção.

**Sobre troca de senha (recomendação original, agora apenas contexto histórico):** o roadmap argumentava que ela é *Should have* porque não resolve esquecimento (exige senha atual) — só resolve comprometimento percebido e higiene, e citava a coluna `passwordChangedAt` como mecanismo de revogação. Essa referência já estava desatualizada mesmo antes de D3: a revogação foi desenhada com `authVersion` (inteiro), não `passwordChangedAt` (ver a comparação completa na seção de P2-02). D3 torna o argumento de prioridade irrelevante: a tarefa é Must have agora, independentemente do trade-off *Should have* que motivou a recomendação original.

### 3.3 Telemetria — auditoria de M4-04 e o que falta para M5-02

Ver §2.5 para os fatos. O que **falta** para M5-02 deixar de estar bloqueada, de forma objetiva:

1. **Persistência.** Eventos `ai_operation` gravados em armazenamento consultável, com retenção definida.
2. **Correlação por nota, gerada no servidor.** Um `correlationId` (UUID) criado no início do processamento de uma nota, presente em toda chamada de IA daquela nota. Sem isso, "chamadas de similaridade por nota" é inderivável de forma confiável.
3. **Confidence bruta persistida**, além do bucket. Buckets fixos na emissão impedem qualquer recalibração posterior de faixa — e é exatamente recalibração de faixa que as "bandas de decisão" de M6-02 exigem.
4. **Decisão de sugestão correlacionável** a estoque e à nota de origem, para poder cruzar aceitação com confidence e com o custo que produziu aquela sugestão.
5. **Volume real.** Nenhum dos itens acima produz dado sem o piloto rodar. É por isso que M5-02 depende de P6, não só de P3.

### 3.4 Custo Gemini — opções de proteção

Ver §2.6 para o risco. Opções avaliadas:

| Opção | Avaliação |
|---|---|
| **Quota no provedor (Google Cloud)** | Necessária como rede de segurança de último recurso, mas **insuficiente sozinha**: quando ela dispara, a aplicação vê erro 429 do provedor e o usuário recebe uma falha genérica de IA. Não é fail-closed controlado. **Recomendo configurar assim mesmo**, como backstop. |
| **Teto global diário + mensal na aplicação** | **Recomendado.** É o único que limita o gasto total independentemente de quantas contas existam. Diário limita o dano de um dia ruim; mensal limita o acumulado. |
| **Teto por usuário/dia** | **Recomendado como segunda camada.** Impede que um participante consuma o teto global inteiro e deixe os outros sem serviço. |
| **Teto por tenant (empresa)** | Adiar. No piloto, usuário ≈ empresa. Adicionar agora é dimensão sem demanda. |
| **Circuit breaker por taxa de falha** | Adiar. Retry limitado (2 tentativas) + timeout de 30s já contêm o custo de indisponibilidade do Gemini. Um breaker é a resposta para *falhas*, não para *custo* — e falhas já são baratas. |
| **Fail-closed** | **Obrigatório.** Se o gasto não puder ser contabilizado (preço de modelo desconhecido, ledger indisponível), a operação de IA é recusada, não permitida. |

**A separação que torna o fail-closed possível.** Autorizar gasto e observar gasto são responsabilidades com contratos de confiabilidade **opostos**, e precisam de dois registros distintos:

| | **A — AI Budget Ledger** | **B — AI Call Events** |
|---|---|---|
| Papel | **autoritativo** para autorizar gasto | histórico e observabilidade |
| Conteúdo | `reserved` / `spent` por `(escopo, período)` | uma linha por chamada: latência, tokens, custo, falha, correlação |
| Contrato de escrita | **forte** — parte da decisão de autorizar | **best-effort** |
| Se a escrita falhar | **o Gemini não é chamado** (503) | a operação de negócio segue normalmente |
| Cardinalidade | poucas linhas (uma por escopo/período) | uma por chamada |
| Dono | **P4-02** | **P3-01** |

Um guard de custo que lesse o gasto de um registro best-effort estaria autorizando dinheiro sobre um dado que o próprio contrato **permite perder**: cada evento perdido é orçamento liberado de graça, silenciosamente. Por isso o ledger é uma estrutura própria, com escrita forte, e **P4-02 não depende de P3-01** para funcionar corretamente.

As duas vivem no mesmo PostgreSQL por uma razão prática: assim a **reconciliação periódica** entre elas é uma consulta SQL, e não uma exportação entre sistemas (P3-04).

O teto configurável também **é o kill switch**: `GEMINI_DAILY_BUDGET_USD=0` desliga toda operação de IA sem derrubar login, discovery, listagem de produtos nem confirmação/rejeição de sugestões pendentes. Isso evita uma feature separada de "modo degradado".

**Concorrência:** o custo só é conhecido *depois* da resposta. Duas requisições simultâneas que só consultem o gasto acumulado antes de chamar passam ambas. A mitigação é reserva atômica no ledger (detalhada em P4-02).

### 3.5 Deploy/runtime

Ver §2.7. O que falta, em ordem de bloqueio: decisão de plataforma → artefato de build → estratégia de migration → segredos → proxy/CORS verificados → smoke test → rollback.

### 3.6 Durabilidade — o que transforma backup em algo confiável

"Fazer backup" não é entrega. **A evidência que transforma backup em confiança é um restore executado, medido e comparado.** Concretamente, três provas:

1. **Prova de existência e frequência:** PITR (ou snapshot diário) habilitado no Postgres gerenciado, com janela de retenção declarada em dias e RPO declarado em minutos.
2. **Prova de restaurabilidade:** um restore real para um banco **novo e separado**, seguido de (a) `prisma migrate status` limpo, (b) contagem de linhas por tabela comparada com a origem, (c) uma consulta de domínio real que retorna dado coerente (ex.: um `ProcessedInvoice` com seus produtos e sugestões), (d) **RTO medido em minutos, cronometrado**.
3. **Prova de que a prova continua valendo:** o restore de um banco vazio prova pouco. O ensaio precisa ser **repetido depois que o piloto gerar dado real**, e o resultado dos dois ensaios registrado com data.

**Rollback de migration:** não existe rollback automático em Prisma e não vamos inventar um. A política correta e barata é **expand/contract**: toda migration do piloto deve ser aditiva e compatível com a versão anterior da aplicação, de modo que o rollback da *aplicação* nunca exija rollback do *schema*. Nenhuma das 9 migrations existentes viola isso, e as tarefas deste roadmap (colunas e tabelas novas, todas nullable ou com default) também não.

### 3.7 Rede e segurança

Ver §2.9. Pontos abertos: `TRUST_PROXY_HOPS` precisa do valor exato da plataforma escolhida **e de verificação empírica** (valor errado significa ou rate limit contornável por `X-Forwarded-For` forjado, ou todos os usuários compartilhando uma única chave de rate limit); `CORS_ALLOWED_ORIGINS` depende de existir ou não frontend no piloto; `/health` público sem limite disputa o pool de conexões.

### 3.8 Suporte operacional

| Situação | Precisa de ferramenta/API? | Solução no primeiro piloto |
|---|---|---|
| Usuário esqueceu a senha / conta travada | **Sim, ferramenta** — hoje é irrecuperável | Script de operador (`scripts/`) que redefine o hash por e-mail, executado contra o banco de produção, com registro em `AuditLog`. **Não** é endpoint HTTP. |
| Diagnosticar nota que falhou | Não | Runbook: `requestId` do header `X-Request-Id` da resposta → busca nos logs. Depois de P3, também consulta SQL na tabela de eventos. |
| Localizar stock/company de um usuário | **Resolvido por P1** | `GET /companies` + `GET /companies/:id/stocks`. Antes de P1, é SQL — e é por isso que P1 é bloqueador. |
| Investigar falha do Gemini | Não | Runbook: filtrar `event=ai_operation status=failure` por `failureCategory`; após P3, agregação SQL. |
| Rollback de deploy | Não | Runbook: redeploy da revisão anterior. Viável porque as migrations são aditivas. |
| Restaurar banco | Não | Runbook do provedor + o ensaio de P5-03 como referência cronometrada. |

Tudo que é **recuperação de dado ou de acesso** precisa de ferramenta. Tudo que é **diagnóstico** pode ser runbook no primeiro piloto.

---

## 4. Escopo do piloto

**Premissas assumidas** (todas confirmáveis em P0-01): coorte pequena e nominalmente conhecida; usuários convidados; não é lançamento público; PostgreSQL gerenciado; uma instância da aplicação; volume baixo; objetivo primário é **gerar dado real sobre DANFE + matching + sugestões + estoque**.

### Must have before pilot

| # | Item | Por quê |
|---|---|---|
| 1 | **Separar `unavailable` de `no_match` na similaridade** | Falha técnica de IA está criando produto no catálogo do cliente. Correção é a prioridade 1 do `CLAUDE.md` |
| 2 | Decisões humanas de P0 registradas | Plataforma determina 4 outras tarefas |
| 3 | `GET /companies` e `GET /companies/:id/stocks` | Sem isso o usuário depende de SQL na segunda sessão |
| 4 | Entropia mínima de `JWT_SECRET` | Segredo fraco aceito silenciosamente é comprometimento total de autenticação |
| 5 | Limite de itens por DANFE | Único vetor de custo ilimitado dentro de uma requisição legítima |
| 6 | Teto de custo Gemini (global + por usuário) com ledger autoritativo e fail-closed | Não há teto de nenhum tipo hoje |
| 7 | Controle de cadastro durante o piloto | Cadastro aberto anula o teto por usuário |
| 8 | Telemetria de IA persistida e consultável | É o **objetivo declarado** do piloto; sem ela o piloto não produz nada |
| 9 | Reconciliação ledger × eventos executada ao menos uma vez | Dois registros sobre a mesma grandeza que nunca são comparados divergem sem ninguém notar |
| 10 | Artefato de deploy + estratégia de migration | Não existe nenhum |
| 11 | Segredos, CORS e `TRUST_PROXY_HOPS` verificados no ambiente real | Valor errado de proxy quebra rate limiting silenciosamente |
| 12 | Backup com restore ensaiado e cronometrado | Estado irrecuperável é o único erro que não se corrige depois |
| 13 | Smoke test de deploy + rollback documentado | Deploy sem verificação é deploy sem informação |
| 14 | Runbooks operacionais, incluindo recuperação de conta travada | Conta travada hoje é permanente |

### Should have during pilot

| Item | Por quê não é Must |
|---|---|
| `PATCH /me/password` (com revogação de tokens) | Não resolve esquecimento; resolve higiene e comprometimento percebido |
| Retenção/purga de eventos de telemetria | Volume de piloto não pressiona armazenamento em semanas |
| Rate limit em `POST /companies` e `/health` | Abuso plausível, impacto limitado com coorte conhecida |
| Índice em `companies(ownerId)` | Tabela pequena; seq scan é adequado. Gatilho: > 10k empresas |
| Segundo ensaio de restore, já com dado real | Depende do piloto ter gerado dado |

### Explicitly deferred

Ver §10 (features deferidas), com gatilho de entrada para cada uma.

---

## 5. Crítica da decomposição proposta

A hipótese apresentada foi P1 Discovery → P2 Change Password → P3 Telemetry → P4 Cost Guard → P5 Deploy → P6 Pilot. **Ela está majoritariamente correta na composição e errada na ordem e na completude.** Cinco ajustes:

| Ajuste | Justificativa |
|---|---|
| **Adicionar um portão de decisão como P0** | A plataforma determina Dockerfile-ou-não, `TRUST_PROXY_HOPS`, sink de log, backup e se há frontend (que determina CORS). Colocar deploy em quinto obriga a adivinhar em P3 e P5. É uma tarefa de horas que remove retrabalho de dias. |
| **Adicionar contenção de abuso ao P4** | O teto por usuário não vale nada com cadastro público aberto, e o teto global não vale nada com número de itens por nota ilimitado. São três tarefas de uma mesma frente, não uma. |
| **Rebaixar P2 (change password) de Must para Should** | Não é bloqueador de piloto fechado (§3.2). O que é bloqueador é a recuperação de conta travada, que é runbook + script e mora em P5. |
| **Promover entropia de `JWT_SECRET` para P2** | Achado do código, não estava na hipótese. `JWT_SECRET="a"` passa no boot hoje. É S, é segurança, e prioridade 2 do CLAUDE.md. |
| **P3 e P4 no mesmo banco, mas em registros separados** *(revisto em r2)* | A r1 dizia que o cost guard **lê a contabilidade que P3 persiste**. Isso estava errado e a correção importa: eventos de telemetria são best-effort por contrato, e autorizar gasto sobre um registro que pode ser perdido é liberar orçamento em silêncio a cada evento perdido. O ledger de orçamento é estrutura própria com escrita forte (P4-02), os eventos são histórico best-effort (P3-01), e a relação entre os dois é **reconciliação periódica** (P3-04), não dependência. Consequência prática: **P4-02 deixa de depender de P3-01**. |

**Três ajustes adicionais da revisão r2:**

| Ajuste | Justificativa |
|---|---|
| **Promover a falha de similaridade a tarefa P0** (novo **P0-02**) | Na r1 isto era uma linha da matriz de riscos, "não mitigado", com a decisão adiada para P6-03 por falta de dado de frequência. Está errado por uma razão de princípio que não depende de frequência nenhuma: `provider_failure` não é evidência de `no_match`. A frequência determinaria **quanto** o defeito custa, não **se** a semântica está correta. E medir com P3 um pipeline cuja semântica sabemos errada é gastar a janela do piloto para quantificar um bug já compreendido. |
| **Reconciliação como tarefa própria** (novo **P3-04**) | Dois registros sobre a mesma grandeza, com contratos de escrita diferentes, divergem. Sem comparação periódica a divergência é invisível — e é exatamente ela que revelaria reserva vazando ou evento perdido. |
| **`authVersion` em vez de `passwordChangedAt`** (**P2-02** reescrita) | A r1 propunha comparar `JWT.iat` com `passwordChangedAt`. `iat` tem resolução de **segundos** e é gravado pelo relógio do processo, enquanto `passwordChangedAt` viria do relógio do banco: dois relógios e uma truncagem produzem uma janela de ~1s de decisão não determinística. Um inteiro comparado por igualdade não tem esse problema e ainda serve à revogação administrativa. Detalhe em P2-02. |

Nada da hipótese original deve ser **removido**. Discovery, telemetria, cost guard e deploy são todos necessários e nenhum é antecipação.

**Estrutura adotada:** `P0` Portão pré-piloto (decisões + correção de semântica) · `P1` Discovery API · `P2` Autenticação operável · `P3` Telemetria consultável · `P4` Contenção de custo e abuso · `P5` Deployment readiness · `P6` Piloto controlado.

**Padrão de identificador:** `P<milestone>-<NN>` (ex.: `P1-01`), consistente com o `M<n>-<NN>` do backlog anterior e sem colidir com ele.

**Escalas** (idênticas às do backlog anterior, deliberadamente): Esforço **S** ≤ 1 dia · **M** 1–3 dias · **L** > 3 dias. Risco = risco *da alteração em si*. Prioridade **P0** bloqueia o marco · **P1** obrigatório · **P2** desejável · **P3** oportunista.

---

## 5-A. Contexto de infraestrutura do piloto *(r3 — decidido)*

Plataforma deixou de ser abstração. Os fatos abaixo foram verificados na documentação dos provedores em **2026-08-15** e são a base de P4-02, P4-03 e de todo o P5. Onde a documentação não publica um número, isto está dito — nenhum valor foi inventado.

### Render Free Web Service

| Fato verificado | Consequência para o roadmap |
|---|---|
| **750 horas de instância grátis/mês por workspace**; serviço suspenso não consome horas | Um único serviço sempre ativo consumiria ~730 h — cabe, mas **não cabe um segundo serviço sempre ativo**. Reforça a topologia de instância única. |
| **Spin-down após 15 min de inatividade; ~1 min de cold start** | A primeira requisição depois de ociosidade demora. Combinada com o *scale to zero* do Neon (abaixo), o pior caso é cold start **duplo**. Precisa estar na comunicação com a coorte, ou parecerá defeito. |
| **Filesystem efêmero**, sem disco persistente | **Benéfico aqui.** `multer` grava em `tmp/` (`invoice-upload.ts:6`) e o `finally` do use case remove; o que sobrar de um crash é apagado no próximo restart. O risco de acúmulo de órfãos registrado na r1 **deixa de existir** nesta plataforma. |
| **Sem shell/SSH e sem one-off jobs no plano Free** | **Os três scripts de operador não têm onde rodar na plataforma.** Rodam localmente contra a `DATABASE_URL` do Neon. Ver P5-05. |
| **Pre-Deploy Command é exclusivo de planos pagos**; no Free, migrations vão no **build command** | Determina a estratégia de migration de P5-01 — e **resolve** o obstáculo levantado na r1: o build instala devDependencies, então o CLI do Prisma **existe** em tempo de build. |
| **Rollback disponível, limitado aos dois deploys anteriores** | Suficiente para o piloto. Reforça a política expand/contract: com migration no build, um rollback de aplicação **não** desfaz schema. |
| **TLS gerenciado e domínio customizado inclusos** | HTTPS resolvido pela plataforma; nada a fazer na aplicação. |
| **SIGTERM com atraso de shutdown padrão de 30 s**, configurável até 300 s | ⚠️ `SHUTDOWN_TIMEOUT_MS` também tem default **30 000** (`env.ts:89`). Empate: a aplicação pode ser **SIGKILLada exatamente enquanto tenta sair limpa**, e o graceful shutdown de M4-01 registraria exit 1 sem motivo real. Ajuste em P5-02: aplicação abaixo do prazo da plataforma. |
| Timeout de requisição da plataforma: **até 100 minutos** | `REQUEST_TIMEOUT_MS` = 120 s cabe folgado. **Sem conflito** — verifiquei porque suspeitava de um limite de 100 s, que não se confirmou. |
| Runtime nativo Node com build/start commands | **Dockerfile não é obrigatório.** Ver P5-01. |

### Neon Free

| Fato verificado | Consequência |
|---|---|
| **0,5 GB de storage por projeto** | Folgado para o volume do piloto, incluindo `ai_call_events` e o ledger. Retenção (P3-03) continua fazendo sentido, agora com teto concreto. |
| **Janela de restore (history retention) de 6 horas**, teto de 1 GB de histórico | ⚠️ **Menor que o requisito do roadmap.** RPO ≤ 6 h só cobre incidente detectado no mesmo dia. Exige `pg_dump` complementar — ver P5-03. |
| **Scale to zero após 5 min de inatividade, sempre ligado no Free, não desativável** | O `SELECT 1` de `/health` (`infra/health.ts:3`) é a primeira query após ociosidade e paga o cold start do compute. Um healthcheck com timeout curto pode marcar o serviço como não saudável **sem que haja falha real**. |
| Connection string com sufixo `-pooler` e **`sslmode=require`** | `DATABASE_URL` do piloto usa a string *pooled* com TLS. O `Pool` do `pg` (`infra/prisma.ts:6`, `max: 10`) é compatível e o limite de conexões do Neon é ordens de grandeza maior. Nada a mudar no código. |
| 10 branches no Free | Suficiente: o restore de ensaio pode usar uma branch separada, sem custo. |

### Gemini Free Tier

| Fato verificado | Consequência |
|---|---|
| `gemini-2.5-flash` **tem free tier**, input e output "Free of charge" | Viabiliza o piloto a custo zero. |
| **Free tier → Tier 1 exige vincular conta de faturamento; não é automático** | **Este é o mecanismo real de garantia de USD 0**: uma chave de API de projeto **sem billing vinculado** não pode gerar cobrança. Ver P4-02, questão 7. |
| **Os números de RPM/RPD/TPD não são publicados na documentação** — a página remete ao AI Studio do projeto; relatos da comunidade divergem fortemente | **Não inventei valores.** Ler os limites reais do projeto no AI Studio é um **gate operacional** de P4-02. |
| **Não há forma programática documentada de consultar cota restante** | O ledger não pode espelhar a cota do provedor. Só pode manter **contadores internos conservadores** — ver P4-02. |
| `429 RESOURCE_EXHAUSTED` é o erro documentado de estouro de limite | ⚠️ **`isTransientError` trata 429 como transitório e faz retry** (`gemini-ai.provider.ts:99`). Sob cota **diária**, o retry imediato não tem chance de sucesso e **queima mais uma requisição da cota compartilhada**. Ver P4-02. |
| **Free tier: "Content used to improve our products: Yes"** (pago: "No") | **Resolvido em r4 (§13-A):** Free Tier fica restrito a desenvolvimento com dado sintético; DANFE real de terceiro exige **Paid Tier**, verificado no gate **P6-00**. |

**Fontes:** [Render — Deploy for Free](https://render.com/docs/free) · [Render — Pre-Deploy Command](https://render.com/changelog/predeploy-command) · [Render — Zero-downtime deploys](https://render.com/docs/zero-downtime-deploys) · [Neon — Plans](https://neon.com/docs/introduction/plans) · [Neon — Free plan limits](https://neon.com/faqs/free-plan-limits-and-quotas) · [Neon — Scale to Zero](https://neon.com/docs/introduction/scale-to-zero) · [Neon — Connection pooling](https://neon.com/docs/connect/connection-pooling) · [Gemini — Rate limits](https://ai.google.dev/gemini-api/docs/rate-limits) · [Gemini — Pricing](https://ai.google.dev/gemini-api/docs/pricing)

---

## 6. Roadmap detalhado

---

# P0 — Portão pré-piloto

*O que precisa estar resolvido antes de qualquer outra coisa ser construída: as decisões que parametrizam metade do roadmap, e a única correção de semântica do pipeline. Construir telemetria sobre um pipeline cuja semântica sabemos incorreta é instrumentar o comportamento errado.*

### P0-01 · Registrar as decisões humanas do piloto

**Status: CONCLUÍDA em 2026-08-28.** As sete decisões que restavam abertas (D1–D7) foram tomadas pelo responsável humano do projeto e registradas em `docs/pilot-decisions.md`, que passa a ser a fonte de verdade para todos os valores que este roadmap referenciava como "decisão humana" ou "P0-01". Duas delas (D4, D7) têm um componente que continua **deliberadamente adiado** — não porque a decisão de P0-01 ficou incompleta, mas porque o próprio responsável decidiu *quando* vai decidir o resto, com uma condição objetiva registrada (`DEFERRED_WITH_GATE`, ver `docs/pilot-decisions.md`). Nenhuma tarefa do piloto fica bloqueada por essas duas pendências — apenas a ativação comercial em Paid Tier (D4) e a comercialização fora do piloto (D7) permanecem condicionadas a evidência/parecer futuros, exatamente como o próprio roadmap já previa.

**Problema.** Cinco tarefas deste roadmap têm sua implementação determinada por decisões que não são inferíveis do código. Executá-las antes das decisões produz retrabalho garantido.

**Objetivo.** Ter, em documento versionado, as decisões que parametrizam P3, P4, P5 e P6.

#### Decisões APROVADAS — 2026-08-15

| Dimensão | Decisão | Alternativas descartadas | Destrava |
|---|---|---|---|
| **Plataforma de aplicação** | **Render Free Web Service** | plataformas pagas; auto-hospedagem | **P5-01, P5-02, P5-04** |
| **PostgreSQL gerenciado** | **Neon Free** | Postgres do próprio Render; provedor pago | **P5-01, P5-03** |
| **Frontend** | **Nenhum durante o piloto** | SPA dedicada; painel mínimo | **P5-02 (CORS)** |
| **Cliente do piloto** | Cliente HTTP direto (Insomnia/Postman/`curl`) | navegador | P6-01 |
| **Cadastro** | **Código de convite compartilhado** | cadastro aberto; criação manual de todas as contas; allowlist de domínio | **P4-03** |
| **Gemini — desenvolvimento** | **Free Tier** | tier pago desde o início | **P4-02 modo A** |
| **Gemini — piloto externo com DANFE real** | **Paid Tier / configuração aprovada, obrigatória ANTES da abertura** *(r4)* | seguir no Free Tier com dado real | **P4-02 modo B**, **P6-00** |
| **Orçamento pago Gemini — desenvolvimento** | **USD 0** | qualquer teto positivo | **P4-02 modo A** |
| **Orçamento pago Gemini — piloto** | **em aberto**, a definir antes de P6 | — | §13 nº 7 |
| **Custo fixo de infraestrutura** | **R$ 0/mês** enquanto Render Free + Neon Free bastarem | — | P5 inteiro |
| **Custo variável de IA** | **aceito a partir da ativação do piloto real**, sujeito a budget guard *(r4)* | manter USD 0 e restringir o dado | **P4-02 modo B** |
| **Topologia** | **Instância única**, sem autoscaling | múltiplas instâncias | confirma M2-01 (rate limit em memória) |

Consequências aceitas conscientemente: cold start de Render e de Neon, ausência de shell na plataforma, janela de restore de 6 h no Neon, e o fato de esta infraestrutura **não ser** a arquitetura definitiva de produção comercial.

**Política de dados enquanto o backend estiver no Free Tier** *(r4)*: o ambiente **não é aprovado** para piloto externo com DANFE real. Desenvolvimento interno segue normalmente — testes automatizados, mocks, fixtures e documentos sintéticos continuam permitidos, e **nada disso bloqueia P0-02 a P5**. O bloqueio incide exclusivamente sobre o momento em que um participante externo envia documento real, e é verificado em **P6-00**.

#### Decisões resolvidas em 2026-08-28 — ver `docs/pilot-decisions.md`

As sete linhas que antes apareciam aqui como "permanecem abertas" foram decididas ou formalmente classificadas. Tabela mantida para rastreabilidade, com o resultado:

| # | Decisão | Resultado | Bloqueava |
|---|---|---|---|
| 1 | Máximo de itens por DANFE | **APPROVED — D1: 100 itens** | **P4-01** (agora destravada) |
| 2 | Tamanho e composição da coorte | **APPROVED — D5: teto de 200, não meta** (composição fica a critério operacional do convite, sem exigência de critério de aceite) | P6-01 (destravada) |
| 3 | Janela/duração do piloto | **APPROVED — D6: 4 semanas** | P6-02 (destravada) |
| 4 | Retenção de `ai_call_events`, em dias | **APPROVED — D2: 60 dias** | P3-03 (parte de retenção destravada) |
| 5 | `PATCH /me/password` entra antes ou depois do piloto | **APPROVED — D3: entra antes**, com escopo ampliado para recuperação por e-mail (nova tarefa **P2-03**, bloqueada só pela escolha de provedor de e-mail) | P2-02 reclassificada para *Must have* |
| 6 | Prazo legal de guarda de `AuditLog` | **DEFERRED_WITH_GATE — D7**: política do piloto decidida (sem purga); prazo definitivo é gate de compliance antes da comercialização, não bloqueador do piloto | — (não bloqueava nada no piloto; segue não bloqueando) |
| 7 | **Budget diário/mensal do Gemini quando o Paid Tier for ativado** *(r4)* | **DEFERRED_WITH_GATE — D4**: Free Tier no piloto é o modo aprovado, sem budget USD arbitrário; valores do Paid Tier comercial ficam explicitamente adiados até haver evidência de custo real | **P4-02 modo B** (valores), P6-00 (framing atualizado) |

*(A pendência de uso de DANFE real sob os termos do free tier foi **resolvida em r4** — ver §13-A.)*

**Dois achados técnicos novos, registrados como tarefas** durante a investigação read-only de `AuditLog` que motivou a revisão de D7: **P3-00A** (cobertura de auditoria para confirmação/rejeição de sugestão) e **P3-00B** (barreira estrutural de payload do `AuditLog`) — ver as seções correspondentes mais abaixo. Nenhuma das duas foi implementada nesta rodada; ambas são registro de escopo.

| | |
|---|---|
| **Dependências** | nenhuma |
| **Esforço** | **S** |
| **Risco** | **Nenhum** — não altera código |
| **Prioridade** | **P0** |
| **Impacto** | Remove adivinhação de todas as tarefas que dependiam de decisão humana. |

**Critérios de aceite.** `docs/pilot-decisions.md` existe e registra as decisões aprovadas **e** as deferidas com gate, cada uma com responsável e data — ✅ satisfeito. A política de tier por tipo de dado (§13-A) está registrada e referenciada pelo gate **P6-00** — ✅ já satisfeito desde r4.
**Testes esperados.** Nenhum (documento).
**Fora de escopo.** Contratar/provisionar qualquer serviço — isso é P5. Reabrir decisão aprovada sem incompatibilidade técnica concreta documentada. Escolher provedor de e-mail (fica com quem decidir P2-03). Inventar valores de budget do Paid Tier (fica com quem decidir após evidência do piloto).

---

### P0-02 · Separar `unavailable` de `no_match` no resultado da similaridade

**Status: CONCLUÍDA em 2026-08-15.**

**Evidência de validação.** RED reproduziu o defeito de duas formas: no provider, cada uma das seis situações resolvia para `null` (12 asserções falhando); e de ponta a ponta, com o `GeminiAiProvider` real e `generateContent` rejeitando `503`, a nota **resolvia com sucesso** — `promise resolved "{ extractedData: …}" instead of rejecting` —, provando que uma falha de transporte criava produto e persistia a nota. 19 testes vermelhos no total.

GREEN: `IAiProvider.findSimilarProduct` passou a devolver `ISimilarityResult` (união discriminada `match` | `no_match` | `unavailable`), `ISimilarityCandidate = IProduct & { id: string }` moveu a invariante de identidade para o tipo, e `SimilarityUnavailableError` (503) aborta a nota antes da transação. `tsc` sob `strict` localizou **todos** os call sites — nenhum dublê pôde continuar devolvendo `null`, que é o efeito pretendido da união.

Validação completa: `prisma generate`/`validate` aprovados · `typecheck` limpo · `lint` 0 problemas · suíte **303/303** (eram 279; +24) · **PostgreSQL Integration Gate 31/31** com 9 migrations do zero · `build` · `verify:production` · `git diff --check` limpo. **Nenhuma migration criada** — a correção é de contrato e fluxo, não de schema.

Escopo preservado: a defesa de M2-06 contra ID alucinado continua recusando o ID; mudou apenas a conclusão tirada dela. Nenhuma regressão nos fluxos de `no_match` (produto novo) e `match` (sugestão pendente), ambos cobertos por teste dedicado.

**Problema.** Ver §2.10 para o levantamento completo. Em resumo: seis situações distintas colapsam em `null`, e a sexta é **falha do provedor**. O chamador lê a ausência de match como evidência de que o item é novo e **cadastra um produto**. Uma indisponibilidade técnica do Gemini vira uma afirmação sobre o catálogo do cliente — silenciosa, irreversível pelo usuário (a chave de idempotência já foi consumida) e em contradição com a invariante declarada no `CLAUDE.md` de que identidade de produto não muda sem decisão determinística ou humana.

**Objetivo.** O resultado de uma tentativa de similaridade passa a ser um dos três estados abaixo, distinguíveis pelo tipo, e falha de provedor **nunca** produz criação de produto.

```
match        → há candidato equivalente com confiança suficiente  → sugestão PENDING (comportamento atual)
no_match     → o modelo respondeu e não há equivalente            → produto novo (comportamento atual)
unavailable  → não obtivemos resposta confiável do provedor       → NÃO decidir  (comportamento novo)
```

**Descrição.** `IAiProvider.findSimilarProduct` passa a devolver uma união discriminada — `{ kind: 'match', product, confidence, reason } | { kind: 'no_match' } | { kind: 'unavailable', reason }` — em vez de `ISimilarityMatch | null`. A união é preferida a "lançar exceção para `unavailable`" por dois motivos: `tsc` sob `strict` passa a **obrigar** o chamador a tratar os três casos (a conflação atual deixaria de compilar), e exceção fica reservada a erro, não a resultado previsto. A **política** de o que fazer com `unavailable` fica no use case, não no provider: o provider relata o que aconteceu, o domínio decide.

**Classificação dos seis casos de hoje:**

| Caso de §2.10 | Novo resultado | Justificativa |
|---|---|---|
| 1 — sem candidatos | `no_match` | não há contra o que comparar; nenhuma chamada é feita. Conclusão legítima. |
| 2 — `matchFound: false` | `no_match` | o modelo respondeu e afirmou que não há equivalente |
| 3 — confiança abaixo do limiar | `no_match` | o modelo respondeu; o limiar é a nossa política, aplicada sobre uma resposta válida |
| 4 — id fora da lista de candidatos | **`unavailable`** | o modelo afirmou match e nomeou algo que não oferecemos. Sabemos apenas que a resposta é inconfiável — não que o item seja novo. A rejeição do id continua sendo a defesa correta (M2-06); muda só o que se conclui dela. |
| 5 — id não resolvido na lista | **`unavailable`** | mesma classe do caso 4 |
| 6 — `catch` de timeout/5xx/JSON/schema | **`unavailable`** | o defeito central |

Os casos 4 e 5 são um julgamento e registro a alternativa: classificá-los como `no_match` manteria a taxa de falha de nota mais baixa, ao custo de tratar uma resposta comprovadamente inconfiável como evidência. Escolho `unavailable` porque é a mesma classe de erro do defeito que a tarefa existe para corrigir. P3-01 dará a frequência real de cada caso, e a reclassificação é reversível com dado.

**Resposta conservadora mínima — três alternativas avaliadas:**

| | **A — Abortar a nota (recomendada)** | **B — Estado `UNRESOLVED` por item** | **C — Retry adicional** |
|---|---|---|---|
| Comportamento | qualquer `unavailable` interrompe o processamento **antes** de `persist()`; nada é gravado; o erro do provedor (502/503/504) propaga | o item fica pendente num novo estado; a nota é persistida sem ele; humano ou job resolve depois | nova camada de tentativas antes de decidir |
| Estado novo | **nenhum** | novo status, migration, endpoints de listar/resolver, máquina de estados | nenhum |
| Persistência parcial | **impossível** — toda a persistência é uma transação única, disparada **depois** do laço (`read-invoice.use-case.ts:213`) | **sim** — nota marcada como processada com efeito parcial no estoque | n/a |
| Recuperação pelo usuário | **reenviar a nota** — a chave de idempotência **não** foi consumida, porque `ProcessedInvoice` só nasce dentro de `persist()` | impossível reenviar (409); depende inteiramente do caminho de resolução existir | n/a |
| Esforço | **S/M** | **L** | S |
| Veredito | **escolhida** | adiada — ver §10 | **já existe**: `GEMINI_MAX_ATTEMPTS=2` com backoff, retry só para 429/5xx/rede (`generateContent`). Mais tentativas gastam mais orçamento sem mudar a semântica. |

A alternativa A é a mais conservadora disponível e a de menor superfície: ela **reusa o comportamento que o pipeline já tem** para falha de extração — `extractDanfeData` que falha já aborta a nota inteira. A correção alinha a similaridade ao que a extração sempre fez, em vez de introduzir um conceito novo.

**Custo aceito, declarado.** Uma nota de 40 itens em que a última similaridade falha é inteiramente reprocessada no reenvio, incluindo a extração — que é a chamada cara. É um custo real. Aceito porque correção precede custo na ordem do `CLAUDE.md`, porque o retry limitado já absorve a falha transitória comum, e porque persistir uma nota com efeito parcial no estoque (alternativa B) é um estado pior e mais caro de desfazer. P3-01 mede a frequência; se for material, B passa a ter justificativa — com dado.

**Telemetria.** O evento `ai_operation` já registra `status=failure` e `failureCategory`; nenhuma mudança de contrato é necessária. P3-01 ganha o requisito de permitir contar notas abortadas por `unavailable`, por `failureCategory`.

| | |
|---|---|
| **Dependências** | nenhuma |
| **Esforço** | **M** |
| **Risco** | **Médio** — é uma **mudança de comportamento deliberada**: notas que hoje "passam" (criando produto errado) passarão a falhar. Exige atualização de testes e de documentação, conforme a seção *Preservação de Comportamento* do `CLAUDE.md`. Risco de implementação é baixo: a união discriminada faz o compilador apontar cada chamador. |
| **Prioridade** | **P0** — **bloqueia P6-01** |
| **Impacto** | Impede que indisponibilidade de IA corrompa o catálogo do cliente de forma silenciosa e irreversível. É a única correção de defeito deste roadmap. |

**Critérios de aceite.**
1. `findSimilarProduct` devolve os três resultados distintos; **não existe mais caminho em que falha de provedor e ausência de match sejam indistinguíveis pelo tipo**.
2. Falha de provedor na similaridade **não cria nenhum produto** e **não cria nenhuma sugestão**.
3. A nota inteira é abortada com o status HTTP do erro de origem (504 timeout / 503 transitório / 502 demais), e a mensagem distingue falha de IA de nota inválida.
4. **Nada é persistido**: nenhum `Product`, nenhuma `ProductSimilaritySuggestion`, nenhum `ProcessedInvoice`.
5. **Reenviar a mesma nota após a falha funciona** e devolve 201, não 409 — a chave de idempotência não foi consumida.
6. Id alucinado (fora da lista de candidatos) é classificado como `unavailable` e **não** cria produto.
7. `no_match` legítimo (`matchFound: false` e confiança abaixo do limiar) **continua** criando produto novo — sem regressão do caminho feliz.
8. O arquivo temporário do upload continua sendo removido no `finally`, também no caminho de aborto.
9. README atualizado: a seção do pipeline passa a descrever o comportamento em falha de similaridade.

**Testes esperados.** Unitário do provider para os seis casos, provando o resultado de cada um; unitário do use case provando zero escrita e zero sugestão quando um item devolve `unavailable`, e provando que o caminho `no_match` segue idêntico; teste de rota para 502/503/504 com mensagem correta; **teste no PostgreSQL Integration Gate provando que após o aborto não há linha em `products`, `product_similarity_suggestions` nem `processed_invoices`, e que o reenvio subsequente é aceito** — é a garantia real de que a idempotência não foi consumida; teste de limpeza do arquivo temporário no caminho de falha.

**Fora de escopo.** Estado `UNRESOLVED` e sua máquina de estados (adiado, §10). Reprocessamento automático de nota. Cache do resultado de extração para baratear o reenvio. Fusão ou exclusão de produtos duplicados criados antes desta correção — se existirem no banco de desenvolvimento, são tratados manualmente; não há dado de produção.

---

# P1 — Discovery API

*Objetivo: o usuário reconstrói todo o contexto operacional a partir de um login, sem SQL.*

### P1-01 · `GET /companies` — empresas acessíveis ao usuário

**Status: CONCLUÍDA em 2026-08-15.**

**Evidência de validação.** RED: três specs referenciando a rota/use case/controller inexistentes falharam por módulo ausente, incluindo `routes.http.spec.ts` (o wiring de `ListCompaniesController` em `CreateRoutesOptions.controllers` é obrigatório, então o arquivo deixa de compilar sem ele — a interface força a atualização do teste). GREEN: `ICompanyRepository.findByOwnerId` (sem chamador) substituído por `findAccessibleById`/`findAccessiblePageByUserId`, com o predicado de autorização (`OR: [{ownerId}, {collaborators: {some: {userId}}}]`) vivendo no repositório — implementado em Prisma e no dublê in-memory (novo `collaboratorUserIds: Map<companyId, Set<userId>>`, mesmo padrão de `InMemoryStockRepository.viewAuthorizedUserIds`). `ListCompaniesUseCase` deriva `role` em memória, sem query adicional. Suíte unitária **303 → 315** (+12); **PostgreSQL Integration Gate 31 → 33** (+2), incluindo prova de **uma única `findMany`** independente da quantidade de empresas (`vi.spyOn(prisma.company, 'findMany')`, chamado exatamente 1 vez para 5 empresas) — evidência concreta de ausência de N+1. Validação completa: `prisma generate`/`validate` ✅ · `typecheck` limpo · `lint` 0 problemas · `build` ✅ · `verify:production` ✅ · `git diff --check` limpo. **Nenhuma migration criada** — a tarefa é de contrato e query, não de schema.

**Problema.** Após o login, não existe nenhuma forma de descobrir quais empresas o usuário tem. `POST /companies` devolve a empresa criada uma única vez; perdido esse retorno, o CNPJ único impede recriar e nada permite consultar.

**Objetivo.** Listar as empresas às quais o usuário autenticado tem acesso, com o papel dele em cada uma.

**Descrição.** Nova rota autenticada `GET /companies`, com paginação por cursor no mesmo padrão de `GET /products` (`limit` default 50, máx. 200; `cursor` = id). Novo método `ICompanyRepository.findAccessiblePageByUserId({ userId, limit, cursor })` com predicado `OR: [{ ownerId: userId }, { collaborators: { some: { userId } } }]`, **substituindo** `findByOwnerId` (hoje sem chamador). `role` é derivado em memória de `ownerId === userId`, sem query adicional. Envelope padrão `{ status: 'success', data: { items, nextCursor } }`.

**Contrato decidido** (respondendo às perguntas do enunciado):

| Pergunta | Decisão | Justificativa |
|---|---|---|
| Só owned, ou owned + colaborações? | **Owned + colaborações**, desde o primeiro dia | É o mesmo custo de query (um `OR` no mesmo `findMany`). Entregar só owned agora força uma quebra de contrato quando colaboração existir. Isto não é antecipação de feature: é escolher o predicado certo para a mesma tarefa. |
| Expor `role`? | **Sim**, `'OWNER' \| 'COLLABORATOR'` | Sem ele o cliente adivinha o que pode fazer. Derivado sem custo. |
| Campos retornados | `id`, `name`, `cnpj`, `createdAt`, `role` | Sem contagens agregadas — seriam N+1 ou subquery sem demanda. |
| Paginação agora? | **Sim** | Um usuário pode criar empresas ilimitadas (`POST /companies` sem rate limit, CNPJ válido é gerável). A lista é ilimitada no caso adversarial. Reusar o padrão de `/products` não introduz conceito novo. |
| N+1? | **Não** — uma query, `role` derivado em memória | |
| Índice novo? | **Não nesta tarefa** | `companies.ownerId` não tem índice (FK não é indexada automaticamente no Postgres), mas a tabela é pequena e o `OR` com colaboradores reduz o benefício. Registrar como custo aceito, com gatilho > 10k empresas — mesma régua orientada a dado de M5. |
| Auditoria? | **Não** | `AuditAction.READ` existe e nunca foi usado. Auditar leitura de discovery é volume alto e valor forense baixo; contraria "evite overengineering". |

| | |
|---|---|
| **Dependências** | nenhuma |
| **Esforço** | **S** |
| **Risco** | **Baixo** — rota nova, nenhuma existente alterada |
| **Prioridade** | **P0** (bloqueia o piloto) |
| **Impacto** | Fecha metade do único gargalo de usabilidade da API. |

**Critérios de aceite.**
1. [x] Owner autenticado recebe 200 com suas empresas e `role: 'OWNER'`.
2. [x] Colaborador recebe as empresas em que colabora, com `role: 'COLLABORATOR'`.
3. [x] Usuário sem nenhuma empresa recebe `200` com `items: []` — nunca 404.
4. [x] Nenhuma empresa de outro usuário aparece em nenhuma condição.
5. [x] `limit`/`cursor` validados por schema; cursor de outro usuário (ou inexistente) é rejeitado com 400.
6. [x] `findByOwnerId` deixa de existir na interface e nos dublês (sem método órfão).

**Testes esperados.** Unitário do use case com dublê in-memory (owner, colaborador, sem acesso, sem duplicidade owner+collaborator simultâneo, paginação com empate de `createdAt`, cursor inválido, ausência de campos internos na resposta); teste de controller cobrindo 401 sem `req.user`; teste de rota (`routes.http.spec.ts`) cobrindo o envelope e o boundary de `limit`; teste no PostgreSQL Integration Gate provando isolamento cross-tenant, papel correto por owner/colaborador, paginação estável e **uma única query** (`findMany` chamado 1 vez) independentemente do volume.

**Fora de escopo.** Criar, editar ou remover empresa. Filtro por nome/CNPJ. Contagem de estoques ou produtos. Qualquer endpoint de colaborador.

---

### P1-02 · `GET /companies/:companyId/stocks` — estoques visíveis da empresa

**Status: CONCLUÍDA em 2026-08-15.**

**Evidência de validação.** RED: `ListCompanyStocksUseCase`/`ListCompanyStocksController` inexistentes; `routes.http.spec.ts` parou de compilar sem `listCompanyStocks` em `CreateRoutesOptions.controllers` (mesmo mecanismo de força-atualização de P1-01). GREEN: `company access ≠ stock access` implementado como dois gates independentes — `ICompanyRepository.findAccessibleById` decide **existência/404**; `IStockRepository.findViewablePageByCompanyId` (nova, substituindo `findByCompanyId` sem chamador) decide **quais estoques**, com owner via `company.ownerId` e colaborador via `StockPermission.canView`, nunca confundidos. Cursor validado por **reuso** de `findByIdForViewer` — nenhuma autorização duplicada. `tsc` confirmou que remover `findByCompanyId` não quebra nenhum dublê fora do escopo (todos usam `as any`/`as unknown as`, sem checagem estrutural). Suíte **330/330** (315→330, +15); **Gate PostgreSQL 37/37** (33→37, +4), incluindo prova de que o owner vê estoques com **zero** linhas de `StockPermission` (critério #17) e de query única (`vi.spyOn(prisma.stock, 'findMany')` chamado 1 vez). `prisma generate`/`validate`, `lint`, `build`, `verify:production`, `git diff --check` aprovados. **Nenhuma migration criada.**

**Revisão de escopo desta rodada — paginação.** O rascunho original desta tarefa (abaixo) decidia **não paginar**, com a justificativa de que estoques nascem só via `createWithDefaultStock` (um por empresa) e não há `POST /stocks`. Essa premissa continua verdadeira, mas a execução foi instruída a reavaliar contra o padrão já adotado por `GET /companies`/`GET /products` — e a consistência de superfície pesou mais que a economia de uma tarefa que já é **S**: cursor + `limit`, mesmo `orderBy [createdAt desc, id desc]`, mesma forma de validação de cursor fora do universo acessível. Registro isto como decisão desta rodada, não como correção de erro da r4 — a versão sem paginação também seria defensável.

**Problema.** O `stockId` é exigido por `GET /products`, `POST /invoices/upload` e `GET /stocks/:id/suggestions`, e só é revelado uma vez, na resposta de `POST /companies`.

**Objetivo.** Listar os estoques da empresa que o usuário pode visualizar.

**Descrição.** Rota autenticada `GET /companies/:companyId/stocks?limit&cursor`. `IStockRepository.findViewablePageByCompanyId({ companyId, userId, limit, cursor })` com o mesmo predicado de autorização já usado em `findByIdForViewer` (owner vê todos; colaborador vê apenas estoques com `StockPermission.canView = true`), **substituindo** `findByCompanyId` (sem chamador). Campos: `id`, `name`, `createdAt` — sem `companyId` (redundante com o path) nem qualquer estrutura de permissão.

**Contrato final:**

| Pergunta | Decisão | Justificativa |
|---|---|---|
| Respeitar `canView`? | **Sim** | É a única semântica de leitura definida no schema. |
| Owner vê todos? | **Sim, sem depender de `StockPermission`** | O predicado Prisma tem o branch de owner (`company.ownerId`) inteiramente independente de `permissions` — provado no Gate com zero linhas de `StockPermission` existindo. |
| Colaborador sem `canView` em nenhum estoque | **`200 []`** | Ele já sabe que a empresa existe (aparece no `GET /companies` dele). Um 403 aqui não protege nada e complica o cliente. |
| Usuário sem relação nenhuma com a empresa | **`404`**, não 403 | Evita confirmar a existência de um `companyId` por enumeração. Mensagem idêntica à de empresa inexistente — testado explicitamente (mesma string). |
| Divergência com o 403 das rotas de estoque existentes | **Mantida, documentada** | Os 403 existentes (`/products`, upload, sugestões) gravam `UNAUTHORIZED_ACCESS` em `AuditLog` — sinal de segurança onde o cliente já traz um `stockId` de origem desconhecida. Rota de discovery não altera esse comportamento. |
| Auditar o 404 de enumeração? | **Não persistir em `AuditLog`; apenas `logger.warn`** com `userId`/`companyId`/`requestId` | Persistir uma linha por sondagem dá a um atacante escrita ilimitada na tabela de auditoria. |
| Paginação? | **Sim, cursor** — revisto nesta rodada, ver nota acima | Consistência com `/companies` e `/products`; nenhum padrão novo introduzido. |
| Cursor de estoque inacessível ou de outra empresa | **`400`** | Reusa `findByIdForViewer(cursor, userId)` — mesma autorização da listagem, sem duplicar regra; `companyId` do resultado comparado ao path param. |

| | |
|---|---|
| **Dependências** | nenhuma (paralelizável com P1-01) |
| **Esforço** | **S** |
| **Risco** | **Baixo** |
| **Prioridade** | **P0** |
| **Impacto** | Fecha o gargalo do `stockId`. Com P1-01, o ciclo operacional inteiro passa a ser navegável pela API. **Discovery mínimo Company → Stock completo.** |

**Critérios de aceite.**
1. [x] Owner recebe todos os estoques da empresa, inclusive sem nenhuma `StockPermission` existir.
2. [x] Colaborador recebe **apenas** os estoques com `canView = true`.
3. [x] Colaborador da empresa sem nenhum `canView` recebe `200 []`.
4. [x] Usuário sem relação com a empresa recebe `404`, com mensagem idêntica à de empresa inexistente.
5. [x] `companyId` inválido (não-UUID) é 400 por schema, antes de qualquer I/O.
6. [x] Nenhuma linha de `AuditLog` é criada por um 404 de enumeração.
7. [x] Cursor de estoque inacessível ao usuário, ou de outra empresa, é rejeitado com 400.
8. [x] Nenhum estoque cross-tenant aparece em nenhuma condição.
9. [x] Query única por chamada (sem N+1), verificado por contagem de invocação do `findMany`.

**Testes esperados.** Unitário in-memory para as combinações de acesso (owner sem permissão nenhuma, colaborador com/sem `canView`, outsider, empresa inexistente, cross-tenant, duplicidade, paginação com empate, cursor inacessível/de outra empresa/inexistente, ausência de campos internos); teste de controller para 401/200; teste de rota para o envelope e os boundaries de `companyId`/`limit`; teste no Gate PostgreSQL com owner + colaborador + `StockPermission` reais, provando `canView`, isolamento cross-tenant, paginação estável e ausência de N+1.

**Fora de escopo.** `POST /stocks`. Alterar nome de estoque. Expor contagem de produtos ou de sugestões pendentes. Gestão de `CompanyCollaborator`/`StockPermission` (write). `canCreate`/`canEdit`/`canDelete`.

---

# P2 — Autenticação operável

### P2-01 · Exigir entropia mínima de `JWT_SECRET`

**Status: CONCLUÍDA em 2026-08-28.**

**Evidência de validação.** RED: `env.spec.ts` ganhou um `describe` dedicado (`entropia mínima de JWT_SECRET`) com 6 casos — ausente, vazio, 1 caractere, 31 caracteres, exatamente 32, 64, e um caso específico provando que a mensagem de erro não reproduz o segredo recebido. Os dois casos de comprimento (31/32) falharam contra a implementação anterior (`Variável de ambiente inválida: JWT_SECRET` nunca lançada), confirmando o gap.

GREEN: `requireJwtSecret` em `src/config/env.ts` — reaproveita `required()` para ausência/vazio e adiciona um `JWT_SECRET_MIN_LENGTH = 32` com a mesma convenção de mensagem (`Variável de ambiente inválida: …`) das demais variáveis. `createEnv` passou a usar `requireJwtSecret` no lugar de `required(environment, 'JWT_SECRET')` — único ponto de validação, sem duplicação em controller/middleware.

**Segredos de teste/CI ajustados** (nenhum secret real): `test/integration/setup.ts` e `scripts/postgres-integration.mjs` (`integration-test-jwt-secret` → `integration-test-jwt-secret-32-chars-min`), `.github/workflows/ci.yml` job `verify` (`ci-only-jwt-secret` → `ci-only-jwt-secret-32-chars-minimum-ok`). O job `production-runtime` já usava `runtime-check-secret-not-for-production` (39 caracteres) — sem alteração necessária.

Validação completa: `prisma generate`/`validate` aprovados · `typecheck` limpo · `lint` 0 problemas · suíte **330/330** · `build` · `verify:production` · `git diff --check` limpo. PostgreSQL Integration Gate não executado — tarefa é de configuração/auth, sem tocar persistência ou schema.

**Nota operacional descoberta durante a execução:** os artefatos compilados (`.js`/`.d.ts`) commitados junto do `.ts` ficam desatualizados após editar o fonte, e o Vitest resolve `import('./env.js')` para o arquivo compilado real em vez do `.ts` quando ambos existem no disco — `npm run build` é obrigatório entre editar `.ts` e rodar a suíte (já documentado no README, seção "Decisões arquiteturais deliberadas"; ver P5-06 para o portão de CI que impede esse artefato de divergir sem ser notado).

**Problema.** `env.ts:81` valida `JWT_SECRET` apenas como string não vazia. `JWT_SECRET=a` sobe a aplicação. HS256 com segredo curto é atacável offline a partir de **um único token capturado**, e um segredo quebrado significa personificação de qualquer usuário — o comprometimento total do modelo de autorização, já que toda autorização deriva de `req.user.id`.

**Objetivo.** Tornar impossível subir o serviço com um segredo de assinatura fraco.

**Descrição.** Adicionar validação de comprimento mínimo (≥ 32 caracteres) a `JWT_SECRET` em `createEnv`, no mesmo padrão fail-fast das demais variáveis. Documentar em `.env.example` e no README como gerar (`openssl rand -base64 48`). Verificar que os segredos do CI (`ci-only-jwt-secret`, `runtime-check-secret-not-for-production`) atendem ao novo mínimo e ajustá-los se não atenderem.

| | |
|---|---|
| **Dependências** | nenhuma |
| **Esforço** | **S** |
| **Risco** | **Baixo** — pode quebrar o boot em ambientes com segredo curto, que é exatamente a intenção. Requer ajuste coordenado do CI. |
| **Prioridade** | **P0** — segurança é prioridade 2 do CLAUDE.md, atrás só de correção |
| **Impacto** | Fecha um caminho silencioso para comprometimento total de autenticação, ao custo de uma função de validação. |

**Critérios de aceite.** `createEnv` lança para `JWT_SECRET` com menos de 32 caracteres, com a mesma mensagem padronizada das outras variáveis; segredo válido continua passando; CI verde com os segredos ajustados; `.env.example` e README documentam o requisito e o comando de geração.
**Testes esperados.** Unitário em `env.spec.ts`: segredo curto lança, segredo de 32+ passa, ausente continua lançando a mensagem de obrigatoriedade.
**Fora de escopo.** Rotação de segredo. Migração para chave assimétrica (RS256/EdDSA). Múltiplas chaves ativas.

---

### P2-02 · `PATCH /me/password` com invalidação dos tokens anteriores

**Status: CONCLUÍDA em 2026-08-28.**

**Evidência de validação.** RED em seis frentes: `jose-token.provider.spec.ts` (novo) provou que tokens sem `authVersion` — reproduzindo exatamente o formato anterior a esta tarefa, montado à mão com a mesma chave — e com `authVersion` de tipo inválido (string/fração/negativo) falhavam a compilação e, corrigido o tipo, seriam aceitos sem checagem; `ensure-authenticated.spec.ts` ganhou casos de versão igual/diferente; `ensure-authenticated.revocation.spec.ts` (novo) prova a propriedade central da escolha de `authVersion` sobre `passwordChangedAt`/`iat` — token emitido e senha trocada **sem nenhum avanço de relógio** produzem rejeição determinística; `change-password.use-case.spec.ts` (novo) cobre senha correta/incorreta/igual, atomicidade e best-effort; `login.spec.ts` ganhou asserção de que o token gerado carrega `authVersion`; `routes.http.spec.ts` ganhou a rota nova e os casos de validação Zod.

GREEN: coluna `authVersion Int @default(1)` (migration `20260828150000_add_user_auth_version`, aditiva); `ITokenPayload`/`IUser` ganham o campo; `JoseTokenProvider.verifyToken` valida tipo/presença da claim, devolvendo `null` (mesmo idioma de token inválido já existente) para claim ausente, string, fração ou negativa — é o único ponto do sistema que faz essa validação, evitando duplicá-la em `ensureAuthenticated`, que só compara igualdade de inteiros já confiáveis; `IUserRepository.updatePassword` grava hash e incrementa `authVersion` num único `UPDATE` (Prisma `{ increment: 1 }`), provado atômico sob concorrência real no gate PostgreSQL (duas escritas simultâneas nunca perdem incremento). Novo evento de auditoria `auditEvents.userPasswordChanged` (entidade `USER`, já prevista na barreira estrutural de P3-00B), registrando só `{ authVersion }`, nunca material de senha — verificado por asserção de que a serialização do evento não contém as strings de senha usadas no teste.

Validação completa: `prisma generate`/`validate` ✅ · `typecheck` limpo · `lint` 0 problemas · suíte **388 → 408** (+20) · **PostgreSQL Integration Gate 37 → 39** (+2: coluna/default reais via `information_schema`, atomicidade sob concorrência real) · `build` ✅ · `verify:production` ✅ · `verify:artifacts` ✅ · `git diff --check` limpo.

**Reclassificada em 2026-08-28 — D3 (`docs/pilot-decisions.md`): passa de *Should have* para requisito ANTES do piloto.** O responsável humano aprovou o escopo de password management completo — troca autenticada (esta tarefa) **e** recuperação por e-mail (nova tarefa **P2-03**, abaixo, mantida separada para não distorcer os critérios de aceite já escritos aqui). Esta tarefa (P2-02) não muda de desenho — a decisão apenas eleva sua prioridade e remove a condicionalidade que o §3.2 registrava.

**Problema.** Não há troca de senha autenticada. Um usuário que suspeita de comprometimento não tem nenhuma ação disponível, e um token vazado permanece válido por até 24 horas sem qualquer forma de revogação.

**Objetivo.** Permitir que o usuário autenticado troque a própria senha, e que essa troca invalide os tokens emitidos antes dela.

**Descrição.** Nova rota autenticada `PATCH /me/password` com corpo `{ currentPassword, newPassword }`. Fluxo: valida por schema (mesma `passwordSchema` de 8–128 já vigente, sem inventar política nova); busca o usuário por `req.user.id`; verifica `currentPassword` com `Argon2HashProvider.compareHash`; recusa se a nova senha for igual à atual; grava o novo hash **e incrementa `authVersion` na mesma escrita**; responde `204 No Content`.

**Revogação — decisão revista em r2: `authVersion`, não `passwordChangedAt`.**

A r1 propunha comparar `JWT.iat` com uma coluna `passwordChangedAt`. Comparando as duas estratégias contra os quatro critérios exigidos:

| Critério | `JWT.iat` × `User.passwordChangedAt` | **`User.authVersion` (inteiro) na claim do JWT** |
|---|---|---|
| Independe de resolução de relógio | **Não.** `iat` é `NumericDate`, resolução de **segundos**, truncado para baixo. `passwordChangedAt` tem precisão de milissegundos. Um token emitido *depois* da troca, no mesmo segundo, tem `iat` truncado para *antes* dela e é rejeitado indevidamente. | **Sim.** Comparação de igualdade entre inteiros. Nenhuma unidade de tempo envolvida. |
| Invalida deterministicamente | **Não.** Além da truncagem, há **dois relógios**: `iat` vem do processo Node que assina; `passwordChangedAt` viria do `now()` do Postgres. Qualquer *skew* entre eles desloca a fronteira nos dois sentidos. | **Sim.** `payload.authVersion !== user.authVersion` ⇒ rejeita. Não há fronteira, há identidade. |
| Funciona com o lookup que `ensureAuthenticated` já faz | Sim | **Sim** — mesma vantagem, custo idêntico: o `findById` já acontece (`ensure-authenticated.ts:26`); o repositório passa a devolver mais um campo. Zero round-trip adicional. |
| Permite revogação administrativa futura | **Não sem mentir sobre o dado.** Revogar sem trocar senha exigiria escrever `passwordChangedAt` sem que senha alguma tenha mudado. | **Sim.** Incrementar `authVersion` é a operação, e ela não afirma nada sobre senha. É exatamente o que o script de recuperação de P5-05 precisa. |

**`authVersion` vence nos quatro critérios e é escolhida.** `passwordChangedAt` é descartada inclusive como coluna informativa: o `AuditLog` já registra *quando* a troca ocorreu, com `userId` e `createdAt`, e uma segunda fonte para o mesmo fato só cria oportunidade de divergir.

*Mudanças que a escolha implica.* Coluna `authVersion Int @default(1)` **não-nula** em `User`. `ITokenPayload` e `generateToken` passam a carregar a claim; `verifyToken` — que hoje devolve apenas `{ sub, email }` e descarta o resto (`jose-token.provider.ts:22-37`) — passa a devolvê-la **validando o tipo** (inteiro), tratando o payload do token com a mesma desconfiança aplicada a qualquer entrada externa. `ensureAuthenticated` compara.

*Token sem a claim (emitido antes desta tarefa):* **rejeitado**. A alternativa — tratar ausência como versão 1 — embutiria um bypass permanente no verificador em troca de não deslogar ninguém, e não há ninguém a deslogar: o sistema é pré-lançamento. O efeito prático é que todos os tokens existentes deixam de valer no deploy desta tarefa, o que é o comportamento seguro.

**Demais decisões.**

| Questão | Decisão | Justificativa |
|---|---|---|
| Rate limit próprio | **Sim**, por usuário, no padrão de `uploadRateLimiter` | Sem ele, a rota vira um oráculo de verificação de senha com custo Argon2 — o mesmo problema que M2-01 corrigiu em `/login`. |
| Resposta | **`204`** sem corpo | Não há dado a devolver. Não reemitir token: o cliente deve refazer login, o que torna a revogação observável. |
| Auditoria | **Sim** — `AuditLog` com `action: 'UPDATE'`, `entity: 'USER'`, **sem nenhum estado de senha** em `previousState`/`newState` | Troca de credencial é evento de segurança. Os estados registram apenas `{ authVersion }` — anterior e novo. |
| Timing/enumeração | **Não aplicável** | A rota é autenticada; o usuário já é conhecido. Basta a mensagem de senha atual incorreta ser genérica e o status 401/403 consistente. |
| Confirmação da senha atual | **Obrigatória** | Sem ela, um token roubado troca a senha e expulsa o dono. |

| | |
|---|---|
| **Dependências** | nenhuma técnica; recomendável após P2-01 |
| **Esforço** | **M** |
| **Risco** | **Médio** — altera o caminho de autenticação, que toda rota autenticada atravessa. Exige teste de que token antigo é rejeitado e token novo aceito. |
| **Prioridade** | **P0 — Must have antes do piloto** (D3, 2026-08-28; era *Should have*, ver §3.2 para o histórico da recomendação anterior) |
| **Impacto** | Dá ao usuário a única ação de segurança que ele pode tomar sozinho, e ao operador a primeira alavanca de revogação existente no sistema. Também é a base de `authVersion` que P2-03 (recuperação por e-mail) reutiliza. |

**Critérios de aceite.**
1. Senha atual correta + nova válida → `204`, e o login subsequente só funciona com a nova senha.
2. Senha atual incorreta → `401`, sem alteração de estado.
3. Nova senha igual à atual → `400`.
4. **Token emitido antes da troca é rejeitado com 401** em qualquer rota autenticada; token emitido depois é aceito. A rejeição é **determinística**, não dependente de intervalo de tempo: um token emitido e uma troca de senha ocorridos no **mesmo segundo** produzem o resultado correto.
5. Token **sem** a claim `authVersion` é rejeitado com 401.
6. Token com `authVersion` de tipo inválido (string, fração, ausente, negativo) é rejeitado com 401, sem lançar exceção não tratada.
7. Rate limit por usuário aplicado, devolvendo `429` via `AppError`.
8. `AuditLog` registra a troca sem nenhum material de senha; o log estruturado idem (já coberto pelo `redact`).
9. Migration aditiva: `authVersion Int @default(1)` não-nula; usuários existentes recebem `1` pelo default, sem backfill manual.
10. O hash e o incremento de `authVersion` acontecem na **mesma escrita** — não há janela em que a senha mudou e a versão não.

**Testes esperados.** Unitário do use case (senha correta/incorreta/igual/hash novo persistido/`authVersion` incrementada atomicamente); unitário de `ensureAuthenticated` para versão igual, versão diferente, claim ausente e claim de tipo inválido; **teste determinístico de mesmo segundo** — assinar token e trocar senha sem avanço de relógio, provando rejeição (é o caso que a estratégia descartada não resolveria); teste de rota para 204/401/400/429 e para a rejeição do token antigo em `GET /companies`; gate PostgreSQL para a migration e para a atomicidade da escrita.

**Fora de escopo.** Recuperação de senha por e-mail — **agora tarefa própria, P2-03** (não mais adiada indefinidamente; ver abaixo). Refresh token. Session store. Logout explícito. Lista de sessões. Alteração da política de senha. Bloqueio de conta por tentativas. **Endpoint de revogação administrativa** — o mecanismo `authVersion` passa a suportá-la, mas a única superfície que a usa nesta fase é o script de operador de P5-05.

---

### P2-03 · Recuperação de senha por e-mail (código temporário)

**Status: criada em 2026-08-28 — D3 (`docs/pilot-decisions.md`). Não implementada. Bloqueada pela escolha de provedor de e-mail (decisão humana ainda não tomada — não escolhida nesta tarefa nem nesta sessão).**

**Problema.** P2-02 cobre troca de senha para quem já está autenticado. Não cobre o caso de esquecimento — um usuário que perdeu a senha e não tem token válido não tem nenhum caminho de autosserviço. O responsável humano do piloto decidiu que isso precisa existir **antes** do piloto, não depois, revertendo a recomendação anterior deste roadmap (§3.2) de tratar isso como runbook de operador.

**Objetivo.** Usuário que esqueceu a senha recebe um código temporário por e-mail, valida o código, e define uma nova senha — sem revelar a nenhum solicitante se um e-mail específico tem conta cadastrada.

**Descrição.** Dois novos endpoints públicos, ambos com rate limit próprio e resposta genérica independente de o e-mail existir ou não:

1. **Solicitar recuperação** (`POST /password-recovery` ou rota equivalente, nome final a definir na implementação): recebe `email`; se existir conta, gera um código temporário aleatório, grava **apenas o hash** do código (nunca o valor em texto puro) com expiração curta e contador de tentativas zerado, e envia o código por e-mail através do provedor a ser escolhido; responde sempre com sucesso genérico, exista ou não a conta — **timing e conteúdo da resposta não podem distinguir os dois casos**.
2. **Confirmar recuperação** (`POST /password-recovery/confirm` ou equivalente): recebe `email`, `code`, `newPassword`; valida o código contra o hash armazenado (comparação seguindo o mesmo padrão de tempo constante já usado para o código de convite em P4-03); código incorreto incrementa um contador de tentativas e recusa acima de um limite; código correto e dentro da validade grava o novo hash de senha e **incrementa `authVersion` na mesma escrita** (mesmo mecanismo de P2-02) — reaproveitando a invalidação de tokens anteriores já construída ali, não reinventando uma segunda forma de revogação.

**Requisitos aprovados (D3), não inventados nesta tarefa:**
- código não revela existência de conta (mensagem e status idênticos nos dois casos);
- expiração curta (valor exato a definir na implementação — não fixado por esta decisão);
- uso único — código consumido no primeiro uso bem-sucedido, ou invalidado após expirar;
- limite de tentativas de validação por código;
- rate limiting dedicado, no padrão de `uploadRateLimiter`/`loginRateLimiter`;
- **somente hash do código é armazenado**, nunca o valor em texto puro — mesma disciplina de `Argon2HashProvider` já usada para senha;
- confirmação bem-sucedida invalida credenciais anteriores via `authVersion` — não um mecanismo paralelo.

**Dependência explícita e não resolvida: provedor de e-mail.** Esta tarefa não pode ser implementada até o responsável humano escolher um provedor (Resend, SendGrid, SES ou outro) — escolha que não foi feita nesta decisão e que o agente não deve fazer sozinho. Até lá, a tarefa permanece bloqueada, não estimada em esforço de calendário.

| | |
|---|---|
| **Dependências** | P2-02 (reutiliza `authVersion`); **escolha de provedor de e-mail — decisão humana em aberto, não coberta por D1–D7** |
| **Esforço** | **M**, a confirmar após a escolha do provedor (integração de terceiro pode adicionar complexidade não estimada aqui) |
| **Risco** | **Médio-alto** — subsistema novo com superfície de ataque própria (enumeração de e-mail, força bruta de código, abuso de envio). Mitigado pelos requisitos já aprovados em D3. |
| **Prioridade** | **P0 — Must have antes do piloto** (D3), mas **bloqueada** até a escolha de provedor |
| **Impacto** | Fecha o caminho de recuperação de conta que hoje só existe como script de operador (P5-05) — decisão humana de trazer isso para autosserviço antes do piloto. |

**Critérios de aceite (preliminares — a confirmar na implementação, após escolha de provedor).**
1. Solicitação de recuperação para e-mail existente e para e-mail inexistente devolvem resposta idêntica em status e corpo.
2. Código correto, dentro da validade e do limite de tentativas → nova senha aceita, `204`/`200`, e login subsequente só funciona com a nova senha.
3. Código incorreto → recusado, contador de tentativas incrementado; acima do limite, recusado independentemente do valor do código.
4. Código expirado → recusado mesmo se correto.
5. Código usado uma vez não pode ser reutilizado.
6. Apenas hash do código persiste no banco — nunca o valor em texto puro, verificado por teste e por revisão de schema.
7. Confirmação bem-sucedida incrementa `authVersion` — tokens emitidos antes deixam de ser aceitos, mesmo teste de "mesmo segundo" que P2-02 já define.
8. Rate limiting dedicado nas duas rotas, devolvendo `429` via `AppError`.
9. Nenhum e-mail, código ou hash aparece em log — mesma disciplina de `redact`/`SENSITIVE_KEYS` já usada para senha/token/segredo de convite.

**Testes esperados.** Unitário do fluxo completo (solicitar → confirmar, com dublê do provedor de e-mail); unitário de expiração, limite de tentativas e uso único; unitário de não-enumeração (resposta idêntica); teste de rota para as duas novas rotas; gate PostgreSQL para a migration de armazenamento do código (hash + expiração + tentativas) e para a atomicidade hash-de-senha + `authVersion`.

**Fora de escopo.** Escolha do provedor de e-mail (decisão humana, fora desta tarefa e fora de D1–D7). Template visual do e-mail. Internacionalização do e-mail. Qualquer outro canal de recuperação (SMS, pergunta de segurança). Login social.

---

# P3 — Telemetria de IA consultável

*A frente arquiteturalmente mais importante. É o objetivo declarado do piloto e a dependência dura de M5-02 e M6-02. **Não** é dependência de correção de P4: o guard de custo tem registro próprio (ver P3-00).*

### P3-00 · Decisão de arquitetura (parte de P3-01, registrada aqui)

O escopo desta decisão é **observabilidade** — o histórico de chamadas. O registro que **autoriza** gasto é outro, tratado em P4-02, e não é opcional nem alternável: precisa de escrita forte no mesmo banco transacional da aplicação.

| Estratégia (para observabilidade) | Custo | Esforço | Retenção | Consulta/agregação | Privacidade | Lock-in | Reconciliação com o ledger |
|---|---|---|---|---|---|---|---|
| **A — PostgreSQL** | ~zero (o banco já existe) | **M** | controlada por nós | **SQL completo, com join no dado de domínio** | dado fica no mesmo perímetro já auditado | nenhum | **consulta SQL direta** |
| B — Plataforma de logs do deploy | incluído/barato | S | 7–30 dias típicos, fora do nosso controle | busca textual; agregação fraca; sem join com domínio | dado sai do perímetro | alto | exportação entre sistemas |
| C — OpenTelemetry + backend externo | assinatura | **L** | boa | excelente | exige política de cardinalidade e de PII | alto | exportação entre sistemas |
| D — Arquivo/objeto + análise ad hoc | baixo | M | manual | fraca sem ferramenta adicional | ok | baixo | manual |

**Recomendação explícita: A — persistir em PostgreSQL.** Três razões, em ordem de peso:

1. **As perguntas do piloto exigem join com dado de domínio** ("custo por nota", "aceitação por faixa de confiança", "chamadas de similaridade por nota"). Isso é trivial em SQL e desconfortável em qualquer plataforma de log.
2. **A reconciliação com o Budget Ledger vira uma consulta, não uma integração.** O ledger de P4-02 é obrigatoriamente transacional e obrigatoriamente no Postgres (ver correção abaixo). Manter os eventos no mesmo banco faz de P3-04 um `SELECT` comparativo; separá-los faria da reconciliação uma exportação entre sistemas, com todo o custo e a defasagem que isso traz.
3. **Volume de piloto é irrelevante para o Postgres.** Ordem de grandeza de dezenas de milhares de linhas.

**Correção da r1, e ela é importante.** A r1 dava como razão decisiva que "o cost guard precisa ler o gasto acumulado de forma transacional" **desta tabela**. Isso invertia a relação e teria produzido um defeito de projeto: `ai_call_events` é, por contrato, **best-effort** — sua escrita pode falhar sem que a operação de negócio seja afetada. Autorizar gasto a partir dela significaria que **cada evento perdido é orçamento liberado de graça**, silenciosamente, e que a proteção de custo herdaria a confiabilidade do registro menos confiável do sistema.

A relação correta são **duas responsabilidades separadas no mesmo banco** (§3.4):

| | **AI Usage Ledger** (`ai_usage_ledger`, P4-02) | **AI Call Events** (`ai_call_events`, P3-01) |
|---|---|---|
| Autoriza gasto? | **Sim — é a autoridade** | Não, nunca |
| Escrita | forte; parte da decisão de chamar o Gemini | best-effort |
| Falha de escrita | **Gemini não é chamado** (503) | operação de negócio segue |
| Granularidade | agregada por `(escopo, período)` | uma linha por chamada |
| Serve para | não estourar o orçamento | entender o que aconteceu |

Nenhuma das duas deriva da outra em tempo de execução. A consistência entre elas é verificada **depois**, por reconciliação periódica (**P3-04**), e a divergência é sinal a investigar — não um erro a corrigir automaticamente.

Riscos de A e como tratá-los: a escrita de eventos entra no caminho quente da requisição (um `INSERT`, custo desprezível) e **jamais pode participar da transação da nota** — uma falha de telemetria não pode reverter uma nota já persistida, exatamente como já vale para `AuditLog`. Crescimento de tabela é tratado por retenção em P3-03. C permanece o sucessor natural quando houver múltiplas instâncias e necessidade de tracing distribuído — não agora, e, mesmo então, **o ledger continuaria no Postgres**: tracing distribuído é observabilidade, não autorização.

---

### P3-00A · Auditar decisões humanas de `ProductSimilaritySuggestion`

**Status: CONCLUÍDA em 2026-09-02.**

**Problema.** `ConfirmProductSuggestionUseCase` e `RejectProductSuggestionUseCase` alteram estado real de produto — `confirm` faz upsert ponderado de quantidade/custo no produto sugerido (`prisma-product-suggestion.repository.ts`, `upsertWeightedProductEntry`); `reject` cria/atualiza um produto diferente do sugerido — mas **nenhum dos dois cria uma linha em `AuditLog`**. A única persistência da decisão é `ProductSimilaritySuggestion.status/decidedAt/decidedByUserId` (tabela própria, correta para o que é) mais uma linha efêmera de telemetria (`ai_suggestion`, stdout, sem retenção). É a única categoria de escrita de domínio real hoje coberta por `persistAuditBestEffort` em nenhum lugar — `CreateCompanyUseCase` e `ReadInvoiceUseCase` auditam; estes dois não.

Isso é relevante especificamente porque confirmar/rejeitar uma sugestão de IA é, segundo a filosofia do `CLAUDE.md`, a decisão humana central do domínio de matching ("nunca aplicar sugestão automaticamente... exigir confirmação humana"). A confirmação existe e é obrigatória; o que falta é o rastro de auditoria dessa confirmação, no mesmo padrão já usado para as demais escritas de produto.

**Objetivo (futuro — não desta rodada).** Garantir que confirmar/rejeitar sugestão deixe trilha de auditoria no mesmo padrão de `ReadInvoiceUseCase` (ação `UPDATE`/`CREATE`, entidade `PRODUCT`, `previousState`/`newState` limitado a `{ quantity, unitPrice, totalPrice }`, sem descrição/código do produto — mesmo payload disciplinado já em uso, sem inventar campo novo).

**Escopo esperado.** Dois use cases (`confirm`/`reject`) ganham uma chamada a `persistAuditBestEffort` cada, análoga à já existente em `read-invoice.use-case.ts:276`, após a escrita transacional do produto. Nenhuma mudança de schema — `AuditLog` já tem todos os campos necessários.

| | |
|---|---|
| **Dependências** | nenhuma técnica — reaproveita `persistAuditBestEffort` e `IAuditLogRepository` já existentes |
| **Esforço** | **S** |
| **Risco** | **Baixo** — best-effort, mesmo padrão já validado em produção pelos outros dois use cases |
| **Prioridade** | **Should have** — não é bloqueador de piloto. O dado da decisão **não se perde** hoje (`ProductSimilaritySuggestion` já registra quem decidiu e quando); o gap é de **consolidação** num único lugar de auditoria, não de perda de informação. Recomendado antes da comercialização, não antes do piloto — reavaliar a classificação se o piloto (P6-02) revelar necessidade real de correlacionar decisões de sugestão com o restante da trilha de `AuditLog`. |
| **Impacto** | Fecha a única lacuna de cobertura identificada na investigação de `AuditLog` — hoje a trilha de auditoria de produto tem uma exceção silenciosa. |

**DoD — cumprido.** Teste unitário provando que `confirm` e `reject` chamam `persistAuditBestEffort` com `action`/`entity`/`previousState`/`newState` corretos (incluindo o caso `CREATE`, produto novo); teste provando que falha na escrita do audit log não reverte a confirmação/rejeição; nenhuma migration necessária — confirmado (whitelist de P3-00B já cobria `PRODUCT:CREATE`/`PRODUCT:UPDATE`).

**Achado de design, resolvido nesta rodada.** `IProductSuggestionRepository.confirm`/`.reject` devolviam só a `ProductSimilaritySuggestion` — o produto afetado (antes/depois da soma ponderada) era calculado dentro da transação e descartado. Auditar exigia esse dado, e reconstituí-lo fora da transação seria uma segunda leitura sujeita a corrida. Solução: os dois métodos passam a devolver `{ suggestion, productId, previousProduct, nextProduct }` — dado que a própria transação já produzia. **O contrato HTTP não mudou**: `ConfirmProductSuggestionController`/`RejectProductSuggestionController` continuam recebendo de volta só a `suggestion` (o use case desestrutura e devolve como sempre) — mudança interna de repositório, não de API pública. `authorizeProductSuggestion` também passou a devolver `companyId` (já resolvido internamente, antes descartado) em vez de só a `suggestion`, que hoje nenhum call site usava.

**Builder próprio, não reuso de `productEntry`.** `productEntry` (usado por `ReadInvoiceUseCase`) tem descrição fixa "Entrada de estoque processada por invoice." — reusá-la para confirm/reject produziria uma trilha de auditoria factualmente errada (a decisão vem de `/suggestions/:id/confirm`\|`/reject`, não de um upload). Novo builder `auditEvents.productSuggestionDecided`, mesma forma (`entity: PRODUCT`, `action` derivada de `previous === null`, estados limitados a `quantity`/`unitPrice`/`totalPrice`), descrição própria por decisão (confirmada/rejeitada). Nenhuma chave nova na whitelist — reaproveita as entradas `PRODUCT:CREATE`/`PRODUCT:UPDATE` já existentes.

**Testes.** Unitário nos dois use cases (dublê de `IAuditLogRepository`: `UPDATE` com produto pré-existente, `CREATE` sem produto anterior, falha da escrita não reverte a decisão, descrição nunca contém "invoice"). Gate PostgreSQL: confirm/reject reais gravam `AuditLog` real com o `previousState`/`newState` corretos, provando que o guard de runtime de P3-00B aceita o payload de fato, não só no dublê.
**Fora de escopo (respeitado).** Auditar leitura de sugestões (`list-pending-product-suggestions`). Qualquer mudança em `ProductSimilaritySuggestion`. Payload adicional além do já usado por `PRODUCT` em `read-invoice.use-case.ts` — não inventar campo novo (`receivedDescription`/`reason` da sugestão continuam fora de `AuditLog`).

---

### P3-00B · Barreira estrutural de payload do `AuditLog`

**Status: CONCLUÍDA em 2026-08-28.**

**Arquitetura escolhida — duas camadas, whitelist positiva.**

1. **Compile time (barreira primária).** `IAuditLog` passa a ser só o modelo de **leitura**; a escrita ganha `AuditLogWrite`, um tipo *branded* (`AuditLogWriteFields & { readonly [brand]: true }`). `IAuditLogRepository.create` aceita apenas ele, e **um único ponto do sistema produz a marca** — o helper `sealed()` de `src/use-cases/audit-events.ts`. Consequência direta: `create({ entity: 'USER', newState: { email, password, token } })` **não compila** em nenhum call site.
2. **Builders por evento.** `auditEvents.companyCreated`, `.invoiceUnauthorizedAccess`, `.invoiceProcessed`, `.productEntry` — quatro funções para os cinco eventos reais (`productEntry` deriva `CREATE`/`UPDATE` de `previous === null`, preservando o ternário que antes vivia no call site). O builder é dono de `entity`, `action`, `description` e da forma dos estados; o call site fornece só os dados. `productAuditState` foi absorvido pelo builder, que extrai `quantity`/`unitPrice`/`totalPrice` e descarta o resto do `IProduct` — um produto inteiro entra, três números saem.
3. **Runtime guard (rede de segurança).** `assertAuditLogWrite` valida entity conhecida, combinação `entity:action` existente, `description` obrigatória, tipos dos IDs opcionais, **whitelist de campos de topo** (é o que recusa `details`), estados planos, valores escalares e **chaves permitidas por evento**. Exercido por **ambas** as implementações — `PrismaAuditLogRepository` (última fronteira antes do `INSERT`) e `InMemoryAuditLogRepository` (para que um teste de use case com payload inválido falhe no dublê, não só em produção).

**`SENSITIVE_KEYS` como fronteira primária: avaliada e descartada, com evidência.** `redact()`/`SENSITIVE_KEYS` de `src/infra/logger.ts` faz **igualdade exata** sobre a chave normalizada, não substring. Verificado em execução: `password`, `token`, `apiKey`, `secret` são bloqueados, mas **`currentPassword`, `newPassword` e `recoveryCode` passam** — precisamente os nomes que P2-02 e P2-03 vão introduzir. Uma blacklist enumera o proibido num espaço infinito; a whitelist por evento enumera o permitido num espaço de 8 chaves. **Nenhuma blacklist foi adicionada**: com a whitelist positiva ela seria código inalcançável, e o projeto proíbe código morto. Os testes de `password`/`currentPassword`/`newPassword`/`recoveryCode`/`token`/`secret` continuam existindo e passando — recusados pela whitelist, que é estritamente mais forte.

**Recusar, não mascarar.** Payload inválido lança `AppError`; nada é gravado. Mascarar produziria uma trilha de auditoria com `[REDACTED]` que aparenta estar correta e esconde o defeito. **A semântica best-effort foi preservada integralmente**: `persistAuditBestEffort` absorve a recusa, registra `logger.error` sem nenhum valor do payload, e a operação de negócio (empresa criada, nota persistida) **não é revertida** — a barreira real é o compile time; a rede de runtime não derruba o trapezista.

**Correção da descrição anterior desta tarefa.** O rascunho dizia "*Fora de escopo: redesenhar `AuditState`*". O resultado real é mais preciso: **`AuditState` permanece intacto como representação de leitura e como tipo interno dos estados**, mas **sai da superfície livre de escrita** — o call site já não o vê, porque fornece dados tipados ao builder. Nenhum redesenho do tipo; uma mudança de quem pode construí-lo.

**`details`:** removido do contrato de escrita (`AuditLogWriteFields` não o tem; o guard recusa o campo; `PrismaAuditLogRepository` não o envia mais). **Mantido na coluna, no `IAuditLog` de leitura e no mapper** — registros legados continuam legíveis. **Nenhuma migration.**

**Evidência de validação.** RED em duas formas: os quatro specs novos falharam por módulo ausente, e um script isolado provou que o repositório **de então** aceitava `entity: 'USER'` com `details` livre e `{ email, password, token, currentPassword, recoveryCode }` em `newState`, persistindo tudo. GREEN: o mesmo payload passa a responder `AppError: Evento de AuditLog recusado: campo "details" não faz parte da superfície de escrita.`, com zero itens no store. Suíte **336 → 388** (+52; 48 → 51 arquivos). **PostgreSQL Integration Gate 37/37**, 9 migrations do zero. `prisma generate`/`validate` ✅ · `typecheck` limpo · `lint` 0 problemas · `build` ✅ (idempotente) · `verify:production` ✅ · `git diff --check` limpo.

**Preservação de comportamento.** Os cinco eventos existentes mantêm `action`/`entity`/`entityId`/`description`/`previousState`/`newState` idênticos, campo a campo — provado por `audit-events.spec.ts`. **Nenhuma asserção de teste existente foi afrouxada.** `create-company.use-case.spec.ts`, os quatro specs de `read-invoice` e os specs de rota passaram **sem uma linha alterada**. Dois testes existentes mudaram por razão estrutural, ambos aprovados antes da alteração: o contrato in-memory (passa a construir via builder, asserções idênticas) e o M6-04 do gate PostgreSQL (idem, **mais** um `INSERT` cru de linha legada com `description`/`details` nulos, para que a cobertura do mapper sobre colunas nulas — que a escrita nova já não produz — não fosse silenciosamente perdida).

**Esforço real: M pequeno** (o rascunho estimava S). 2 arquivos de fonte novos, 6 alterados, 3 specs novos, ~36 artefatos compilados regenerados.

**Problema.** `AuditLog.details` (`String?`), `previousState`/`newState` (`Json?`) não têm nenhuma validação de schema no banco nem redaction no caminho de persistência — `redact()`/`SENSITIVE_KEYS` (`src/infra/logger.ts`) protege o **log estruturado** (stdout), nunca `PrismaAuditLogRepository.create()`. Hoje não há vazamento: os dois únicos use cases que escrevem em `AuditLog` (`CreateCompanyUseCase`, `ReadInvoiceUseCase`) passam apenas IDs, contadores e três números (`quantity`/`unitPrice`/`totalPrice`) — disciplina de quem escreve, não barreira do sistema. Um use case futuro (por exemplo, **P2-02/P2-03**, que tocam credenciais) poderia persistir acidentalmente `password`, `token`, hash, ou o conteúdo de um documento em `previousState`/`newState`, e nada no schema ou no repositório impediria isso.

**Objetivo (atingido).** Um contrato/guard estrutural que limite o que pode ser persistido em `AuditLog`, **recusando** antes da escrita qualquer chave fora da whitelist do evento — o que cobre `password`, `passwordHash`, `currentPassword`, `newPassword`, `recoveryCode`, `token`, `jwt`, `apiKey`, `secret`, conteúdo integral de documento e payload arbitrário, sem depender de enumerar nomes proibidos.

**Abordagem avaliada e superada.** O rascunho previa escolher entre (a) reaproveitar `redact()`/`SENSITIVE_KEYS` do logger e (b) um assert de runtime sobre os estados. A investigação mostrou que **(a) é insuficiente** (ver a evidência acima) e que **(b) sozinha deixaria `entity`, `action` e `description` livres**. A solução implementada é mais forte que as duas: barreira de compile time por tipo branded, com (b) como rede redundante. Registro que a alternativa que eu havia enumerado foi superada por uma que não estava na lista.

**Por que isto ganha urgência agora, não é só higiene abstrata:** D3 (`docs/pilot-decisions.md`) já aprovou P2-02/P2-03 como requisito pré-piloto, e ambos tocam exatamente a superfície de risco que esta tarefa endereça (P2-02 já audita `{ authVersion }`; P2-03 vai precisar de disciplina equivalente para código de recuperação). Recomenda-se executar esta tarefa **antes ou junto com P2-02**, não depois — não como bloqueador formal, mas porque a janela de risco (novo call site de `AuditLog` tocando credenciais) abre exatamente com essas duas tarefas.

| | |
|---|---|
| **Dependências** | nenhuma técnica |
| **Esforço** | **M pequeno** (realizado; o rascunho estimava S) |
| **Risco** | **Baixo** — é uma restrição adicional sobre um caminho já existente, sem mudar o formato dos dois use cases atuais |
| **Prioridade** | **Should have, executada antes de P2-02** — a janela de risco que ela fecha abre exatamente com P2-02/P2-03 |
| **Impacto** | Fecha a segunda lacuna identificada na investigação de `AuditLog`: ausência de barreira estrutural, hoje mascarada pela disciplina dos dois call sites existentes. |

**DoD cumprido.** Decisão registrada (recusar, não mascarar); testes provando recusa de chave sensível em `previousState`/`newState`/`details`; os dois use cases existentes passando sem alteração de comportamento; guard exercido pelas duas implementações; brand provado por `@ts-expect-error` que o `tsc` valida.
**Fora de escopo (respeitado).** Adicionar coluna nova ao schema. Qualquer evento de `ProductSimilaritySuggestion` — é P3-00A, e nenhum builder, entity ou enum foi criado especulativamente para ele. Aplicar a mesma barreira a `ai_call_events` (P3-01 já define, por design, que nenhum conteúdo de documento entra ali — não precisa do mesmo guard).

---

### P3-01 · Persistir eventos de chamada de IA com correlação gerada no servidor

**Status: CONCLUÍDA em 2026-09-02.**

**Problema.** `IAiTelemetry.recordCall` escreve uma linha JSON em stdout e nada mais. Sem retenção, sem consulta, sem agregação. Toda pergunta que o piloto existe para responder é, hoje, inrespondível. E a única chave de correlação disponível (`requestId`) **é aceita do cliente** (`request-id.ts:8`): um cliente que envie sempre o mesmo `X-Request-Id` colapsa toda a correlação de custo e de chamadas-por-nota.

**Objetivo.** Toda chamada ao Gemini produz uma linha consultável em PostgreSQL, correlacionável por nota através de um identificador que o cliente não controla.

**Descrição.** Nova tabela `ai_call_events` com: `id`, `correlationId` (UUID gerado no servidor), `requestId` (o do cliente, guardado só para cruzar com log — **nunca como chave**), `operation`, `model`, `modelVersion`, `status`, `durationMs`, `attempts`, `inputTokens`, `outputTokens`, `totalTokens`, **`estimatedCostUsdNanos`**, `failureCategory`, `userId`, `companyId`, `stockId`, `createdAt`. Índices: `(createdAt)`, `(correlationId)`, `(operation, createdAt)`.

**Custo estimado × custo faturado — a distinção é obrigatória e vale a renomeação** *(r3)*. Sob Free Tier o custo **faturado é zero**, mas o valor calculado por `calculateGeminiCostUsdNanos` continua sendo produzido e persistido, porque responde a duas perguntas que o piloto precisa responder: *"quanto este sistema custaria fora do Free Tier?"* e o insumo de custo relativo de **M5-02**. Por isso o campo se chama **`estimatedCostUsdNanos`**, e não `costUsdNanos`: um número rotulado como custo, num sistema onde nada é cobrado, vira relatório errado no primeiro leitor desatento. A regra que decorre disso e vale para consultas, runbook e relatório: **estimativa nunca é apresentada como cobrança**, e o relatório de P6-03 declara o faturado como zero explicitamente, em vez de omiti-lo.

`ReadInvoiceUseCase` gera um `correlationId` no início do processamento e o propaga ao `IAiProvider` no mesmo lugar onde hoje propaga `requestId`. Nova implementação `PrismaAiTelemetry` de `IAiTelemetry` (a interface não muda de forma; ganha os campos de contexto), mantendo o log estruturado como canal secundário de debug. Escrita **best-effort e fora de qualquer transação de domínio**, reutilizando o padrão de `recordAiTelemetryBestEffort`.

**Contrato de confiabilidade — explícito e vinculante.** Esta tabela é **observabilidade**, não contabilidade. Ela é best-effort por decisão: perder um evento nunca pode reverter uma nota já persistida. A consequência que precisa estar escrita no código, não só aqui: **nada em `ai_call_events` pode ser usado para autorizar consumo.** A autoridade é o `ai_usage_ledger` de P4-02, com escrita forte e fail-closed. As duas tabelas descrevem a mesma grandeza sob contratos opostos e são comparadas periodicamente por P3-04 — jamais uma derivada da outra em tempo de execução.

**Interação com P0-02.** Depois que a similaridade passar a distinguir `unavailable` de `no_match`, o campo `failureCategory` deixa de ser apenas diagnóstico e passa a explicar **por que uma nota inteira foi abortada**. O modelo de dados já suporta isso sem alteração; o que a tarefa acrescenta é o requisito de que a consulta "notas abortadas por indisponibilidade de IA, por categoria" seja respondível — ela é o insumo que decide, com dado, se o estado `UNRESOLVED` (§10) chega a ter justificativa.

**Privacidade e cardinalidade.** Nada de conteúdo de documento, descrição de produto, `accessKey` ou prompt é persistido. `correlationId` é um UUID opaco sem relação derivável com a nota. Para permitir investigar uma nota específica no futuro, `ProcessedInvoice` ganha uma coluna `correlationId` nullable — assim a ligação nota↔custo existe **dentro do banco, sob as mesmas regras de acesso**, e nunca em log.

| | |
|---|---|
| **Dependências** | P0-01 (retenção decidida); **P0-02 recomendada antes** — instrumentar antes de corrigir a semântica é medir o comportamento errado |
| **Esforço** | **M** |
| **Risco** | **Médio** — toca o caminho quente do upload. Mitigado por best-effort e por ficar fora da transação da nota. |
| **Prioridade** | **P0** |
| **Impacto** | Transforma o piloto de "usar o sistema" em "medir o sistema". Sem isto, o piloto roda e não produz nada. |

**Critérios de aceite — todos cumpridos.**
1. ✅ Um upload bem-sucedido grava exatamente uma linha `invoice_extraction` e uma linha `product_similarity` por chamada realmente feita, todas com o mesmo `correlationId` — provado em unitário (`read-invoice.use-case.spec.ts`) e no gate real (Postgres).
2. ✅ Chamada que falha também grava linha, com `status='failure'` e `failureCategory` preenchido — comportamento preservado de `GeminiAiProvider.recordCall`, agora persistido.
3. ✅ Falha de escrita da telemetria **não** falha o upload e **não** reverte a nota — provado com o recorder rejeitando de forma síncrona e assíncrona (`prisma-ai-telemetry.spec.ts`, `gemini-ai.telemetry.spec.ts`).
4. ✅ `correlationId` é gerado no servidor (`randomUUID()` em `ReadInvoiceUseCase.execute`); um `X-Request-Id` fixo em N uploads produz N `correlationId` distintos — teste explícito.
5. ✅ Nenhuma coluna contém conteúdo de documento, descrição de produto ou `accessKey` — provado no gate real serializando as linhas persistidas.
6. ✅ Migration aditiva (tabela nova + coluna nullable em `processed_invoices`) — `20260902120000_add_ai_call_events`.
7. ✅ **Nenhum caminho de código lê `ai_call_events` para decidir se uma chamada de IA pode acontecer** — verificado por grep: o único `findMany` do projeto sobre a tabela é a asserção do próprio teste de gate.

**Decisões de implementação registradas:**
- `estimatedCostUsdNanos` (não `costUsdNanos`) no tipo do evento — mesma renomeação já decidida acima, agora também no código, não só no schema.
- `userId`/`companyId`/`stockId` entram na tabela mas são **excluídos** do canal de log estruturado por whitelist positiva (`toLoggableCallEvent`, `src/infra/ai-telemetry.ts`) — mesmo princípio de P3-00B aplicado a uma segunda dimensão sensível (identificador de tenant, não credencial).
- `operation`/`status`/`failureCategory` persistidos como `String` (não enum Prisma): tabela best-effort e de alto volume, cujo objetivo é nunca bloquear a operação de negócio; um enum divergente entre app/migration transformaria um evento não crítico em erro de `INSERT`. Trade-off documentado, não silencioso.
- **Sem FK para `User`/`Company`/`Stock`**: tabela de alto volume, best-effort, deliberadamente desacoplada do ciclo de vida dessas entidades — nenhuma consulta desta tarefa navega a relação via Prisma, e a reconciliação futura (P3-04) é esperada por `correlationId`/agregação, não por join relacional.
- `PrismaAiTelemetry.recordCall` recusa persistir (lança) quando `correlationId` está ausente, em vez de gravar um placeholder — "recusar, não mascarar", mesmo princípio de P3-00B; a recusa é absorvida pelo best-effort do call site, nunca propaga.

**Testes esperados — implementados.** Unitário de `PrismaAiTelemetry` (mapeamento de campos, opcionais ausentes, recusa sem `correlationId`, best-effort síncrono/assíncrono, `recordSuggestion` delega sem persistir); unitário do use case provando um `correlationId` por nota compartilhado por todas as chamadas e N distintos para N uploads; unitário provando que falha de telemetria não propaga; gate PostgreSQL escrevendo e lendo eventos reais, verificando os três índices via `pg_indexes` e a ausência de conteúdo sensível.

**Fora de escopo (respeitado).** Dashboard. Exportação. Endpoint HTTP de telemetria. Retenção (P3-03) — nenhum TTL/purge implementado. Qualquer decisão sobre batching (M5-02). Persistência de `ai_suggestion_events` (P3-02) — `recordSuggestion` permanece log-only, delegado sem alteração de comportamento.

---

### P3-02 · Persistir decisões de sugestão de forma correlacionável

**Status: CONCLUÍDA em 2026-09-02 — como VIEW, não tabela nova (ver critério de aceite 1).**

**Problema.** `recordSuggestion` emite `{ decision, confidenceBucket }` e nada mais. Não há `requestId`, `suggestionId`, `stockId` nem confidence bruta. É impossível ligar uma decisão humana à nota que a originou ou à chamada de IA que a produziu — e o bucket fixo na emissão impede qualquer recalibração posterior de faixa, que é exatamente o que as bandas de M6-02 exigiriam.

**Objetivo.** Cada evento de sugestão (`created`/`confirmed`/`rejected`) fica registrado com confidence bruta e chaves de correlação suficientes para cruzar aceitação × confiança × custo.

**Descrição.** Nova tabela `ai_suggestion_events`: `id`, `suggestionId`, `correlationId` (o da nota que criou a sugestão), `stockId`, `companyId`, `decision`, `confidence` (**Decimal bruto**, mesma precisão do schema: `Decimal(5,4)`), `decidedByUserId?`, `createdAt`. Índices `(createdAt)` e `(stockId, createdAt)`. `confidenceBucket` continua no log estruturado, mas deixa de ser a única forma persistida — o bucket passa a ser calculado **na consulta**, não na emissão.

**Nota importante.** Grande parte deste dado já existe em `product_similarity_suggestions` (`confidence`, `status`, `decidedAt`, `decidedByUserId`, `stockId`, `processedInvoiceId`). A tabela de eventos existe para capturar o que a tabela de estado **não** captura: a sequência temporal e o `correlationId`. Antes de implementar, a tarefa deve confirmar se uma **view** sobre `product_similarity_suggestions` + `processed_invoices` responde às perguntas do piloto — se responder, a tabela nova **não deve ser criada**, e a tarefa se reduz a definir a view e propagar `correlationId`. Esta verificação é parte da tarefa, não um detalhe: é a diferença entre uma tabela necessária e uma tabela por simetria com P3-01.

| | |
|---|---|
| **Dependências** | **P3-01** (`correlationId`) |
| **Esforço** | **S** |
| **Risco** | **Baixo** |
| **Prioridade** | **P1** |
| **Impacto** | É a única fonte possível para as bandas de decisão de M6-02 e para medir qualidade de matching. |

**Critérios de aceite — todos cumpridos.**
1. ✅ **A alternativa "view em vez de tabela" foi avaliada e escolhida, com justificativa registrada abaixo.** Não é uma nota lateral — é o resultado real da tarefa.
2. ✅ Confidence é lida **bruta** (`Decimal(5,4)` de `product_similarity_suggestions.confidence`, sem arredondamento nem bucket) — na verdade nem chega a ser "persistida" de novo: a view lê a única cópia que existe, eliminando por construção qualquer risco de ela divergir de um valor duplicado.
3. ✅ Toda sugestão criada produz um evento `created` (join com `processed_invoices` para o `correlationId` da nota); toda sugestão confirmada/rejeitada produz também um segundo evento (`confirmed`/`rejected`), com `stockId`/`companyId` em ambos.
4. ✅ **Falha de registro não altera o resultado de confirmar/rejeitar — automaticamente, por construção.** Não há escrita própria para falhar: a view lê exatamente o estado que a transação de `confirm`/`reject` (P3-00A) já grava com garantia transacional. O critério best-effort de P3-01 não se aplica aqui pela mesma razão que não se aplica a uma consulta `SELECT` sobre `AuditLog`.
5. ✅ É possível responder "taxa de aceitação por faixa de confiança", com as faixas definidas **na consulta** (`CASE WHEN confidence < ... THEN ...`), nunca na emissão — provado no gate com uma agregação real (`COUNT(*) FILTER (WHERE decision = ...)` agrupado por faixa).

**Decisão registrada: view, não tabela.** As três razões, em ordem de peso:
1. **Todo o dado já existe, sob um contrato de escrita mais forte do que o de qualquer tabela de evento poderia ter.** `product_similarity_suggestions.status`/`decidedAt`/`decidedByUserId`/`confidence` são gravados na mesma transação Postgres que atualiza o produto (P3-00A) — a garantia mais forte disponível no sistema. Uma tabela `ai_suggestion_events` best-effort seria uma SEGUNDA cópia desse mesmo dado sob um contrato mais fraco, reproduzindo exatamente o padrão de risco que a separação ledger/eventos (P3-01/P4-02) já existe para evitar: duas fontes da mesma verdade, sujeitas a divergir em silêncio.
2. **O `correlationId`, a única peça que faltava, já existe fora desta tarefa.** P3-01 já adicionou `ProcessedInvoice.correlationId`; a view só precisa de um `JOIN`, não de propagação nova.
3. **Uma view elimina inteiramente a superfície de falha que uma tabela nova introduziria.** Sem escrita própria, não há best-effort para errar, não há retry, não há linha perdida — o critério de aceite 4 deixa de ser algo a implementar e passa a ser uma consequência estrutural.

**Migration:** `20260902130000_add_ai_suggestion_events_view` — `CREATE VIEW "ai_suggestion_events"` (`UNION ALL` de dois `SELECT`s: todo registro gera `created` a partir de `createdAt`; `status IN (CONFIRMED, REJECTED)` gera um segundo evento a partir de `decidedAt`). Aditiva, sem tocar dado existente. Nenhuma FK/índice novo necessário — a view lê índices já existentes (`product_similarity_suggestions(stockId, status)`, PKs de `processed_invoices`/`stocks`).

**Testes.** Gate PostgreSQL: 3 sugestões semeadas (`PENDING`, `CONFIRMED`, `REJECTED`) produzem exatamente 5 linhas na view (3 `created` + 2 decididas); `correlationId` da nota presente em todas; `confidence` bruta (`'0.9123'`, não bucket); agregação de aceitação por faixa definida na consulta devolve o resultado esperado. Nenhum teste unitário novo — não há código de aplicação para testar (nenhuma tabela, nenhum repositório, `IAiTelemetry` inalterada).

**Fora de escopo (respeitado).** Definir as bandas de M6-02 (a query do gate usa uma faixa de exemplo, não a definitiva). Alterar o limiar de similaridade. Endpoint HTTP. O runbook formal de consultas nomeadas — isso é P3-03.

---

### P3-03 · Consultas de referência, retenção e runbook de telemetria

**Status: CONCLUÍDA em 2026-09-02.** `docs/telemetry-runbook.md` com as 8 consultas (cada uma testada contra dado semeado real, `test/integration/telemetry-runbook.integration.spec.ts`); retenção via `scripts/purge-ai-call-events.mjs` (`npm run retention:ai-call-events`), 60 dias fixos (D2), script de operador — sem scheduler automático (Render Free não oferece cron/one-off jobs, mesma restrição já registrada em §5-A para os demais scripts). Provado idempotente e que nunca toca `AuditLog`.

**Retenção destravada em 2026-08-28 — D2 (`docs/pilot-decisions.md`): 60 dias para `ai_call_events`.** Aplica-se somente a essa tabela — explicitamente não ao `AuditLog` (D7: sem purga durante o piloto) nem ao `ai_usage_ledger` (nunca apagado, já era critério de aceite).

**Problema.** Dado persistido sem consulta escrita é dado que ninguém usa sob pressão. E tabela de evento sem retenção cresce sem limite.

**Objetivo.** As oito perguntas do piloto têm, cada uma, uma consulta SQL versionada e testada; a retenção está definida e implementada.

**Descrição.** `docs/telemetry-runbook.md` com uma consulta nomeada por pergunta: (1) latência avg/p50/p95 por `operation`; (2) tokens por nota; (3) custo por nota; (4) custo por dia e acumulado do mês; (5) taxa de falha por `failureCategory`; (6) distribuição de confidence; (7) taxa de aceitação/rejeição por faixa; (8) chamadas `product_similarity` por nota (distribuição, não só média). Cada consulta acompanhada da pergunta operacional que ela responde e da leitura esperada. Retenção: **60 dias** (D2), implementada como `DELETE` por idade em script de operador — **não** um job automático nesta fase, e **sem** tocar em `AuditLog`, cuja política conservadora (mantida também durante o piloto por D7) permanece intacta.

| | |
|---|---|
| **Dependências** | P3-01, P3-02 |
| **Esforço** | **S** |
| **Risco** | **Baixo** |
| **Prioridade** | **P1** |
| **Impacto** | É o que separa "temos os dados" de "conseguimos responder". Também é o insumo direto de P6-03. |

**Critérios de aceite — todos cumpridos.**
1. ✅ As 8 consultas existem em `docs/telemetry-runbook.md`, rodam contra o schema real e devolvem resultado coerente com dado semeado — cada uma com um teste dedicado em `test/integration/telemetry-runbook.integration.spec.ts`.
2. ✅ Retenção definida em dias (60, D2) e implementada como script idempotente (`scripts/purge-ai-call-events.mjs`) — provado rodando duas vezes seguidas (segunda execução remove 0 linhas).
3. ✅ `AuditLog` explicitamente fora do escopo da purga — o script só conhece o model `aiCallEvent` (nenhum parâmetro de tabela), e o teste semeia uma linha antiga de `AuditLog` e confirma que ela sobrevive, byte a byte (`createdAt` inalterado), às duas execuções.
4. ✅ **A retenção nunca apaga linhas do `ai_usage_ledger`** — tabela ainda nem existe (P4-02 não implementada); quando existir, o script continua estruturalmente incapaz de tocá-la, por não referenciar nenhuma tabela além de `aiCallEvent`.

**Nota sobre o mecanismo de execução (achado desta rodada).** O Render Free não tem cron/one-off jobs (mesma restrição já registrada em §5-A para os demais scripts de operador — recuperação de conta, reconciliação). Isso não bloqueia a tarefa: o DoD pede explicitamente um **script de operador**, não um job automático ("**não** um job automático nesta fase") — o mecanismo certo já estava especificado no próprio texto da tarefa, sem necessidade de inventar um scheduler. `npm run retention:ai-call-events` é o comando real; quem/quando executar é registrado no runbook, não fingido como já provisionado.

**Testes.** Gate PostgreSQL semeando eventos conhecidos e verificando o retorno de cada uma das 8 consultas (valores exatos, não só formato); teste do script de retenção via `execFileSync` do binário real (`node scripts/purge-ai-call-events.mjs`), não uma reimplementação em memória — apaga o que passou da idade, preserva o resto, preserva `AuditLog`, é idempotente.
**Fora de escopo (respeitado).** Dashboard. Alertas. Purga automática agendada (scheduler). Qualquer alteração em `AuditLog`. Reconciliação — é P3-04.

---

### P3-04 · Reconciliar periodicamente o Budget Ledger com os eventos de IA

**Status: CONCLUÍDA em 2026-09-03.** `scripts/reconcile-ai-usage.mjs` (`npm run reconcile:ai-usage [YYYY-MM-DD]`), somente leitura, roda contra as duas fontes reais.

**Achado do Design Review, antes de decidir a fórmula (não assumida previamente).** `ai_call_events` tem **uma linha por operação lógica** (`extractDanfeData`/`findSimilarProduct`); `ai_usage_ledger.spentRequests` debita **uma unidade por tentativa HTTP** (P4-02, critério 12 — cada retry conta). Comparar `COUNT(ai_call_events)` com `spentRequests` compararia grandezas diferentes por construção, sempre divergindo quando há retry, sem que isso seja perda nem anomalia. A comparação correta é `SUM(ai_call_events.attempts)` — a coluna já registra quantas tentativas aquela operação fez — contra `ledger.spentRequests`.

**Segundo achado, também descoberto ao ler o código real, não previsto no desenho original desta tarefa.** Dentro do laço de retry (`GeminiAiProvider.generateContent`), o contador de tentativas (`onAttempt()`) incrementa **antes** da reserva no ledger (`budgetGuard.reserveAttempt`). Se essa reserva for recusada por cota no meio de um retry, a tentativa **já contou** para `ai_call_events.attempts` daquela operação, mas **nunca chega a debitar** `spentRequests` (a reserva é revertida antes de qualquer reconciliação). Resultado: `SUM(attempts)` pode legitimamente ficar **uma unidade acima** de `spentRequests` sem que nada tenha "escapado do guard" — é o oposto: o guard funcionou, e a tentativa bloqueada ainda assim incrementou o contador de telemetria. **Isto amplia, não substitui,** a linha "eventos > ledger: anomalia" da tabela de divergências abaixo — o script trata essa diferença de pequena magnitude como dentro da tolerância, citando essa possibilidade explicitamente, em vez de sinalizá-la como anomalia automática.

**Problema.** Depois de P3-01 e P4-02 existem **dois** registros do mesmo gasto, deliberadamente sob contratos de escrita opostos: o ledger (forte, autoritativo) e os eventos (best-effort, histórico). Dois registros da mesma grandeza que nunca são comparados **divergem em silêncio** — e a divergência é justamente o sintoma que revelaria reserva vazando, evento perdido ou estimativa mal calibrada. Sem esta tarefa, cada um dos dois números parece confiável isoladamente e ninguém descobre que discordam.

**Objetivo.** A divergência entre ledger, eventos e a fatura real do provedor é medida periodicamente, tem faixa de tolerância declarada e vira sinal acionável quando a excede.

**Descrição.** Script de operador que, para um período, compara as fontes **que realmente existem naquele estágio** — e os estágios são dois *(r4)*:

| Estágio | Fontes comparadas | Faturamento |
|---|---|---|
| **Free Tier (desenvolvimento)** | ledger · eventos · painel de cota do AI Studio | **esperado zero — e verificar que continua zero é o controle** |
| **Paid Tier (piloto real)** | ledger · eventos · uso do provedor · **dado de billing** | valor real, comparado ao estimado |

**O contrato do script é o mesmo nos dois; muda o que está disponível para preencher.** A quarta linha da tabela abaixo troca de significado sem trocar de forma: no Free Tier, "faturamento ≠ 0" é anomalia grave (alguém habilitou billing sem passar pelo gate); no Paid Tier, é o número esperado, e a anomalia passa a ser **divergir demais do estimado**.

Nenhuma integração com a API de billing é construída agora. O objetivo é **deixar o contrato preparado**, não antecipar infraestrutura: a leitura de billing continua manual nos dois estágios, e automatizá-la só se justifica se o volume tornar a conferência manual inviável.

A r2 previa a fatura como terceira fonte sempre presente; a r3 a removeu por não existir sob USD 0; a **r4 a reintroduz como condicional ao estágio** — que é a forma correta desde o início.

| Fonte | O que ela é | Autoridade sobre | Disponibilidade no piloto |
|---|---|---|---|
| `ai_usage_ledger` (`spentRequests`, `spentTokens`) | o que a aplicação **autorizou** | deixar ou não chamar o Gemini | SQL |
| `ai_call_events` (contagem, `SUM(totalTokens)`, `SUM(estimatedCostUsdNanos)`) | o que a aplicação **observou** | análise e diagnóstico | SQL |
| Painel de cota/uso do AI Studio | o que o **provedor contabilizou** | a verdade sobre a cota | **leitura manual** — não há API documentada (P4-02, questão 1) |
| Faturamento Google | o que foi **cobrado** | verdade financeira | **estruturalmente zero** — projeto sem billing |

**A quarta linha não é ornamento.** Verificar periodicamente que o faturamento continua zero é como se detecta que alguém habilitou billing no projeto — o único caminho pelo qual o piloto passaria a gastar dinheiro. É barato: uma olhada no console, registrada.

Divergências esperadas — o script precisa distingui-las de anomalia, e cada uma tem sinal previsível:

| Divergência | Causa esperada | Sinal |
|---|---|---|
| eventos **<** ledger | escrita best-effort perdida | normal em volume pequeno; alerta se persistente |
| ledger **<** painel do provedor | tentativas que falharam sem `usageMetadata`; contagem de tentativas divergente | esperado; **calibra a margem do teto interno** |
| `reserved` **> 0** após a virada do período | reserva vazada — falha entre reservar e reconciliar | **anomalia**: investigar P4-02 |
| eventos **>** ledger, por 1 unidade de `attempts` | **achado na implementação:** tentativa recusada por cota no meio de um retry incrementa `attempts` do evento antes de a reserva ser revertida — nunca chega a debitar o ledger | **não é anomalia** — é o guard funcionando; o script cita essa possibilidade e não sinaliza dentro da tolerância |
| eventos **>** ledger, além da tolerância | ledger não registrou consumo que aconteceu | **anomalia**: investigar `correlationId` específicos, consumo pode ter escapado do guard |
| **faturamento ≠ 0 no estágio Free** | billing habilitado sem passar pelo gate P6-00 | **anomalia grave**: agir imediatamente |
| **faturamento muito acima do estimado no estágio Paid** | preço desatualizado em `MODEL_PRICING`, ou consumo não contabilizado | **anomalia**: recalibrar preço e investigar o gap |

**Tolerância implementada:** `max(1, ceil(5% do valor do ledger))`, aplicada independentemente a requests/tokens/custo. O piso de 1 unidade é uma interpretação deliberada, registrada aqui: no volume do piloto (teto de 18 requisições/dia), 5% puro chegaria a zero e sinalizaria qualquer perda isolada de telemetria como anomalia — o que contradiria a própria tabela acima ("normal em volume pequeno"). `reserved` residual não nulo e qualquer faturamento diferente de zero continuam anomalia independentemente de valor, sem tolerância. O número é ponto de partida; P6-02 recalibra com dado real.

**Onde o script roda:** na máquina do operador, contra a `DATABASE_URL` real (Neon, quando P5-01 concluir) — Render Free não oferece shell nem one-off jobs (§5-A). Testado nesta tarefa contra o Postgres efêmero do gate; a execução periódica real durante o piloto é responsabilidade operacional de P6-02, não desta tarefa.

**Princípio que a tarefa preserva — verificado.** A reconciliação **nunca corrige automaticamente** nenhuma das fontes: `scripts/reconcile-ai-usage.mjs` só lê (`findMany`/`aggregate`), nunca chama `update`/`create`/`delete`. Provado no gate: snapshot de todas as linhas antes e depois de rodar o script, com divergência deliberadamente semeada, é idêntico.

**Superfície escolhida:** script de operador (`node scripts/reconcile-ai-usage.mjs [YYYY-MM-DD]`, também `npm run reconcile:ai-usage`), sem argumento usa o dia anterior em UTC — um período já fechado. Reconciliar o dia corrente produziria falso positivo de "reserva vazada" para uploads genuinamente em andamento (`reservedRequests` só some quando a reconciliação daquela tentativa específica termina). Nenhum endpoint HTTP administrativo foi criado — não havia requisito para isso, e seria uma superfície nova de autorização para um caso de uso que já tem dono (o operador, com acesso direto ao banco, mesmo padrão dos demais scripts desta cadeia).

| | |
|---|---|
| **Dependências** | ✅ **P3-01** e **P4-02** — as duas fontes existem |
| **Esforço** | **S** |
| **Risco** | **Baixo** — somente leitura |
| **Prioridade** | **P1** — exigida antes de P6-02, para que os números da janela sejam confiáveis |
| **Impacto** | É o que impede que a separação entre ledger e eventos vire duas verdades não verificadas. Também é o único detector de reserva vazada. |

**Critérios de aceite — todos cumpridos.**
1. ✅ O script roda para um período e reporta as somas das duas fontes (requests via `SUM(attempts)`, não `COUNT`; tokens; custo) e suas divergências.
2. ✅ Distingue divergência esperada de anomalia — incluindo a nuance de tentativa recusada por cota (achado desta tarefa, não estava na tabela original).
3. ✅ Detecta `reserved` residual — sempre anomalia, sem tolerância.
4. ✅ **Não escreve em nenhuma das fontes** — provado no gate (snapshot idêntico antes/depois).
5. ✅ A tolerância está declarada e justificada (`max(1, 5%)`, com a razão do piso registrada acima).
6. ⏸ O procedimento manual de conferir o painel de cota **e o faturamento zero** — o script imprime um lembrete a cada execução; o procedimento completo, passo a passo, pertence ao runbook de operação (`docs/pilot-runbooks.md`, P5-05, ainda bloqueada por P5-01) — registrado como pendência dessa tarefa, não desta.
7. ⏸ A reconciliação executada ao menos uma vez **antes de P6-02** — verificada nesta tarefa contra dado semeado real no gate; a primeira execução contra dado de piloto real acontece quando o piloto rodar (P6-01/P6-02), fora do alcance de execução autônoma sem ambiente de produção.
**Testes — 13 cenários no gate PostgreSQL, todos verdes no primeiro run (confirma a fórmula derivada no Design Review).** Caso reconciliado; requests divergentes além da tolerância (eventos > e < ledger); divergência de 1 unidade tratada como não-anomalia (caso benigno de cota); tokens divergentes; custo divergente; evento sem `usageMetadata` (falha) não distorce tokens/custo; múltiplos usuários reconciliados de forma isolada; escopo global agrega todos os usuários sem vazar para escopos de usuário específicos; rollover de período (evento do dia seguinte nunca conta); zero eventos e zero ledger; reserva residual sempre anômala mesmo com requests/tokens batendo; somente leitura (snapshot idêntico antes/depois).
**Fora de escopo (respeitado).** Correção automática. Alerta ativo (e-mail/webhook). Leitura automatizada do painel do AI Studio ou do faturamento — **não há API documentada**; a conferência é manual, lembrada a cada execução, procedimento completo pertence ao runbook de P5-05. Endpoint HTTP administrativo — não criado, sem requisito.

---

# P4 — Contenção de custo, cota e abuso

*As três tarefas são interdependentes por construção: um teto por usuário não vale nada com cadastro aberto, e um teto global não vale nada com número de itens por nota ilimitado.*

**Nota da r3.** Com `paid budget = USD 0` e Gemini restrito ao Free Tier, **o recurso escasso deixa de ser dinheiro e passa a ser cota** — requisições e tokens por dia, de um projeto, compartilhados por toda a coorte. Isto **não** enfraquece P4; troca a unidade de medida. As três tarefas permanecem obrigatórias, e a razão está no enunciado da decisão: free tier não é controle de abuso. Um participante ainda pode, sozinho, esgotar a cota diária e deixar o piloto inteiro sem sistema — o que, do ponto de vista dos outros participantes, é indistinguível de uma indisponibilidade.

### P4-01 · Limitar o número de itens por DANFE

**Status: CONCLUÍDA em 2026-08-28.** `N = 100`, decisão **D1** (`docs/pilot-decisions.md`), aprovada pelo responsável humano do piloto: limite operacional do piloto (não regra fiscal), sujeito a revisão com evidência real de distribuição de itens por DANFE observada na janela (P6-02/P6-03).

**Evidência de validação.** RED: `gemini.schemas.spec.ts` (novo) provou que um DANFE com 4 itens passava sem erro contra um teto de 3; `env.spec.ts` ganhou o caso de `DANFE_MAX_ITEMS`; `gemini-ai.provider.spec.ts` ganhou o caso de excesso (422 + mensagem contendo o teto configurado) e a prova de que `generateContent` é chamado **uma única vez** (a nota é abortada, não há segunda chamada de similaridade); `read-invoice.use-case.spec.ts` e `routes.http.spec.ts` ganharam a tradução do erro através das camadas.

GREEN: `danfeResponseSchema` virou fábrica `createDanfeResponseSchema(maxItems)` — não referencia `env` no módulo, o que manteve o schema testável isoladamente sem exigir que todo teste que apenas importa `routes.js` (e nunca chega a analisar um DANFE) precisasse simular a variável. `GeminiAiProvider.parseDanfeResponse` chama a fábrica com `env.DANFE_MAX_ITEMS` e distingue, pelos `issues` do Zod (`code: 'too_big'`, `path: ['products']`), o excesso de itens de qualquer outra falha de schema — produzindo uma mensagem específica (`"...mais itens do que o limite permitido (N)."`) em vez do genérico `"dados incompatíveis com um DANFE"`. O mesmo `env.DANFE_MAX_ITEMS` alimenta `responseSchema.properties.products.maxItems` no prompt (fonte única, mesmo padrão de `SIMILARITY_CONFIDENCE_THRESHOLD`, M6-02). Nova variável `DANFE_MAX_ITEMS` em `env.ts` (default 100, faixa 1–1000).

Validação completa: `prisma generate`/`validate` ✅ (sem mudança de schema) · `typecheck` limpo · `lint` 0 problemas · suíte **408 → 418** (+10) · **PostgreSQL Integration Gate 39/39** (sem regressão; tarefa não toca persistência) · `build` ✅ · `verify:production` ✅ · `git diff --check` limpo.

**Problema.** `danfeResponseSchema.products` é `z.array(...).min(1)` **sem `.max()`**. O número de chamadas `product_similarity` de um upload é `N` = itens não-casados, e `N` é controlado pelo **conteúdo do documento**, não pelo sistema. Uma única requisição, dentro do rate limit, pode disparar um número arbitrário de chamadas ao Gemini. Qualquer teto de orçamento fica com uma cauda ilimitada dentro de uma requisição enquanto isso valer.

**Objetivo.** Uma requisição de upload tem um custo máximo conhecido e finito.

**Descrição.** Adicionar `.max(100)` ao array de produtos em `danfeResponseSchema` e o mesmo limite no `responseSchema` enviado ao Gemini (`maxItems`), para que o modelo não gaste tokens gerando o que será rejeitado. Nota que excede o limite falha com `AppError` de 422 e mensagem clara, **antes** de qualquer chamada de similaridade — a validação já acontece no ponto certo do fluxo (`extractDanfeData` → parse → `read-invoice` valida). `N = 100` é a decisão **D1**, não um valor escolhido nesta tarefa. Tornar configurável por env (default 100), com o mesmo padrão validado das demais — mantém a porta aberta para a revisão prevista em D1 sem exigir novo deploy de código.

| | |
|---|---|
| **Dependências** | ~~P0-01 (valor de `N`)~~ — **satisfeita**: `N = 100` (D1) |
| **Esforço** | **S** |
| **Risco** | **Médio** — um limite baixo demais rejeita nota legítima, que é falha de correção, prioridade 1 do CLAUDE.md. Por isso o valor vem de decisão humana registrada (D1), não de suposição. |
| **Prioridade** | **P0** |
| **Impacto** | Torna o custo por requisição limitado. É pré-condição para que o teto de P4-02 signifique alguma coisa. |

**Critérios de aceite.** Nota com `N` itens é processada normalmente; nota com `N+1` é rejeitada com 422 e mensagem clara **sem** ter disparado nenhuma chamada de similaridade; o limite é configurável e validado no boot; `.env.example` e README documentam o valor e sua origem.
**Testes esperados.** Unitário do schema no limite e acima; unitário do use case provando **zero** chamadas ao `aiProvider.findSimilarProduct` quando a nota excede; teste de rota devolvendo 422.
**Fora de escopo.** Processamento parcial de nota grande. Paginação/chunking de itens. Qualquer alteração na estratégia de matching.

---

### P4-02 · Guard de orçamento Gemini com reserva atômica e fail-closed

**Status: CONCLUÍDA em 2026-09-03 — Modo A completo, D8 (`docs/pilot-decisions.md`).** Retomada assim que o dono da conta leu os limites reais no AI Studio (`gemini-2.5-flash`, nível gratuito: RPM=5, TPM=250k, RPD=20, **TPD não publicado**) e formalizou os tetos internos de requisições (18/dia global, 5/dia por usuário) e a decisão explícita de **não** configurar teto de tokens nesta primeira versão, por ausência de base empírica — ver D8 para o texto completo, incluindo o porquê de TPD ausente nunca poder ser tratado como zero, ilimitado, ou `TPM × minutos`. O mecanismo (ledger, reserva atômica global+usuário numa única transação, reconciliação, fail-closed, kill switch) está implementado e testado contra PostgreSQL real. **Modo B (custo, Paid Tier) permanece bloqueado** por D4 — nada nesta tarefa antecipa Modo B; os valores 18/5 são específicos do Modo A e não devem ser reaproveitados como política comercial.

*(Título revisto em r3: era "Guard de orçamento Gemini". A unidade mudou de USD para cota; o desenho, não.)*

**Confirmado em 2026-08-28 — D4 (`docs/pilot-decisions.md`): o piloto opera em Modo A** (tetos de requisições/tokens, sem dimensão de custo), exatamente como já desenhado abaixo — nenhuma mudança de design decorre desta decisão. **Modo B (Paid Tier comercial) permanece bloqueado** até quatro condições explícitas (budget guard, teto diário, teto mensal, evidência de custo real do piloto) — ver D4 para o texto completo do gate. Os valores de teto do Modo B continuam **deliberadamente não inventados**.

**Problema.** Não existe nenhum teto de consumo. Não existe forma de desligar a IA sem derrubar o serviço (`GEMINI_API_KEY` é obrigatória no boot). Sob Free Tier, o dano deixa de ser financeiro e passa a ser de **disponibilidade**: um participante que esgote a cota diária do projeto deixa toda a coorte sem sistema, e não há como distinguir isso de uma queda.

**Objetivo.** O consumo de Gemini tem tetos internos conservadores, aplicados pela aplicação, em requisições e tokens; ao esgotar, o sistema degrada de forma limpa e previsível, e todas as operações não-IA continuam funcionando. Gasto pago permanece estruturalmente impossível.

---

#### Análise obrigatória do Free Tier *(r3)*

As sete perguntas exigidas, respondidas contra documentação verificada em 2026-08-15. Onde a resposta não está publicada, isso é dito — nada foi inferido.

| # | Pergunta | Resposta |
|---|---|---|
| 1 | Há informação programática confiável sobre **cota gratuita restante**? | **Não.** A documentação de rate limits não expõe nenhum método de consulta de cota; remete ao painel do AI Studio. O ledger **não pode espelhar** a cota do provedor — só manter contador próprio. |
| 2 | Dá para distinguir, **antes da chamada**, "esta continuará gratuita" de "esta será cobrada"? | **Não por chamada — e a pergunta perde sentido no nosso caso.** Free × pago **não é propriedade da requisição**, é propriedade do **projeto**: depende de haver conta de faturamento vinculada. Sem billing, *nenhuma* chamada pode ser cobrada; com billing, o projeto vira Tier 1 por inteiro. A distinção é binária e de configuração, não de runtime. |
| 3 | O Free Tier é controlado por qual dimensão? | Por **cota de requisições e de tokens** (RPM/RPD, TPM/TPD), no escopo do **projeto**, com o tier determinado pela conta de faturamento. Não é por chave nem por chamada. |
| 4 | Quais limites se aplicam a `gemini-2.5-flash`? | **Não publicados na documentação.** A página remete ao AI Studio do projeto, e relatos públicos divergem em mais de uma ordem de grandeza. **Gate operacional:** ler os valores reais do projeto no AI Studio e registrá-los em `docs/pilot-decisions.md` antes de configurar os tetos internos. **Não fixei número.** |
| 5 | O provedor retorna erro quando a cota acaba? | **Sim — `429 RESOURCE_EXHAUSTED`.** |
| 6 | Um projeto com billing pode continuar atendendo e passar a cobrar depois da franquia? | **Sim, e é exatamente o cenário a evitar.** Habilitar billing promove o projeto a Tier 1; o consumo além da franquia passa a ser cobrado sem nova confirmação. |
| 7 | Qual configuração do Google é o **hard backstop** de USD 0? | **Usar chave de API de um projeto SEM conta de faturamento vinculada.** É a única garantia estrutural, e ela vive **fora** da aplicação. Nenhum código pode substituí-la — e nenhum código pode anulá-la. |

**Gate operacional decorrente** (obrigatório antes de P6-01, verificável, não é código): confirmar que o projeto emissor de `GEMINI_API_KEY` **não** tem conta de faturamento vinculada; registrar em `docs/pilot-decisions.md` os limites reais lidos no AI Studio; e registrar quem é o dono da conta e quem tem permissão para habilitar billing.

#### Consequência direta no código existente

⚠️ **`isTransientError` classifica `429` como transitório e dispara retry** (`gemini-ai.provider.ts:99`, `GEMINI_MAX_ATTEMPTS=2`). Esse comportamento foi projetado para *throttling por minuto*, onde esperar 250 ms e tentar de novo faz sentido. Sob **cota diária esgotada**, o retry não tem nenhuma chance de sucesso e **consome mais uma requisição da cota compartilhada** — piora exatamente a condição que o disparou. Esta tarefa deve distinguir 429 de janela curta (retry mantido) de 429 de cota esgotada (**sem retry**, e alimentando o degradê de indisponibilidade), usando o corpo/status detalhado da resposta do provedor. Se a distinção não for confiável na prática, o comportamento conservador é **não repetir 429** — o custo de perder um retry legítimo é uma nota reenviada; o custo do contrário é cota da coorte queimada em tentativas inúteis.

#### Dois modos, um mecanismo *(r4)*

A decisão §13-A significa que o guard **não pode ser desenhado só para o Free Tier**: ele atravessa a fronteira para o Paid Tier quando o piloto real abrir. **Não são duas arquiteturas** — é o mesmo ledger, com a mesma reserva atômica e o mesmo fail-closed, evoluindo por **configuração**.

| | **Modo A — desenvolvimento no Free Tier** (implementado, D8) | **Modo B — piloto no Paid Tier** |
|---|---|---|
| Recurso escasso | cota: requisições/dia (tokens só observados, ver D8) | dinheiro, além de requisições e tokens |
| Dimensões controladas | `requests` (`tokens` acumula sem teto) | `requests`, `tokens`, **`estimatedCost`** |
| Períodos | diário | **diário e mensal** |
| Teto por usuário | sim (requisições) | sim |
| Gasto pago | **impossível** (projeto sem billing) | **permitido até o orçamento configurado** |
| Ao esgotar | 503/429, degradê controlado | idêntico |

O que **muda** entre os modos é apenas: quais dimensões têm teto configurado, e se existe período mensal. O que **não muda**: a tabela, a reserva atômica, o fail-closed, a separação em relação aos eventos, os códigos HTTP, o kill switch.

Concretamente, o modo é consequência de **quais tetos estão configurados**, não de um `if (mode)` espalhado pelo código. Um teto ausente é "sem limite nesta dimensão"; um teto presente é aplicado. **Ajustado por D8:** a implementação real do Modo A configura teto só de **requisições** (global e por usuário); **tokens ficam deliberadamente sem teto** nesta primeira versão, por ausência de base empírica — o mecanismo "dimensão ausente = sem limite" é exatamente o que torna isso seguro, e não um desvio do desenho. Modo B, quando decidido, pode acrescentar teto de tokens e os de custo diário/mensal, todos pela mesma via de configuração. Isso mantém uma única implementação e torna a transição uma mudança de variáveis de ambiente — que é exatamente o que o gate P6-00 vai verificar.

**O custo estimado já é calculado hoje** (`calculateGeminiCostUsdNanos`), então o modo B **não exige mecanismo novo** — exige que a dimensão "custo" passe a ter teto. Essa é a razão de o ledger guardar dimensões genéricas em vez de ser um contador de requisições: não é generalidade especulativa, é a fronteira que já sabemos que vamos atravessar.

#### Papel do ledger — decisão

Das quatro possibilidades levantadas, a escolha é **B com o componente de observabilidade de C** — e explicitamente **não D**.

| Opção | Veredito |
|---|---|
| A — guard financeiro em USD | **Descartada.** Guardaria dólares que, sem billing, não podem ser cobrados. Um guard cuja condição nunca dispara é código morto que aparenta proteção. |
| **B — usage/quota guard interno** (requisições e tokens, reservas, tetos conservadores) | **Escolhida.** É onde está o recurso realmente escasso e realmente compartilhado. |
| C — combinação | **Parcialmente.** O **custo estimado continua sendo calculado e persistido**, mas em `ai_call_events` como observabilidade (P3-01), **não** como base de autorização. |
| D — desnecessário, o cap do provedor basta | **Rejeitada, e a evidência aponta na direção contrária.** O cap do provedor garante USD 0 e **nada mais**: não impede um participante de consumir a cota de todos, e degrada com `429` bruto para a coorte inteira, sem controle nosso. Trocaria uma proteção nossa por uma indisponibilidade de terceiros. |

*Registro autoritativo — `ai_usage_ledger`* (renomeado de `ai_budget_ledger` em r3, porque a unidade mudou). Tabela **própria desta tarefa**, distinta de `ai_call_events`: `(scope, scopeId, periodKind, period)` como chave, mais `reservedRequests`, `spentRequests`, `reservedTokens`, `spentTokens`, **`reservedCostUsdNanos`, `spentCostUsdNanos`** e `updatedAt`. `scope` ∈ `global | user`; `periodKind` ∈ `day | month`. Poucas linhas, agregadas, escrita forte.

As colunas de custo existem desde o modo A **sem teto configurado** — acumulam o estimado e ficam prontas para receber teto no modo B. Uma coluna somando é barata; uma migration no meio do piloto para adicioná-la, não.

**Os tetos internos são deliberadamente inferiores à cota real do provedor.** O ledger não conhece a cota do Google (questão 1) e não deve fingir que conhece: ele impõe um limite **nosso**, calibrado abaixo do limite lido no AI Studio, de modo que a aplicação recuse antes que o provedor recuse. A diferença é decisiva — recusa nossa é um erro tratado, com mensagem clara e as demais rotas funcionando; recusa do provedor é um `429` no meio do pipeline.

**Ela não é, e não pode virar, uma projeção de `ai_call_events`.** Os eventos são best-effort — sua escrita pode falhar sem consequência para o negócio, por decisão explícita de P3-01. Autorizar consumo sobre um registro cujo contrato permite perder linhas significaria que **cada evento perdido é cota liberada silenciosamente**, e que a proteção herdaria a confiabilidade do componente menos confiável do sistema. Por isso: escrita forte, na mesma decisão que autoriza a chamada, e **P4-02 não depende de P3-01** para estar correta. A consistência entre os dois registros é verificada depois, por **P3-04**, e nunca em tempo de execução. *A mudança de unidade da r3 não afeta nada disto — o contrato da r2 é preservado integralmente.*

*Concorrência — reserva atômica (preservada da r2).* O consumo real só é conhecido depois da resposta, então "consultar o acumulado e então chamar" deixa duas requisições simultâneas passarem. Desenho recomendado, em duas fases, ambas sobre o ledger:

1. **Reserva.** Antes de chamar o Gemini, um único statement atômico (`INSERT ... ON CONFLICT (scope, scopeId, period) DO UPDATE SET reservedRequests = reservedRequests + 1, reservedTokens = reservedTokens + :estimate RETURNING ...`) reserva **uma requisição** e uma **estimativa conservadora de tokens** para aquele tipo de operação. Se o valor retornado exceder o teto, a reserva é devolvida e a operação é recusada. Um statement, sem transação explícita, sem lock de aplicação.
2. **Reconciliação.** Depois da resposta, a reserva é liberada e o **consumo real** (`usageMetadata`, o mesmo já usado pela telemetria) é somado ao gasto.

A reserva de **requisições** ficou mais simples e mais forte que a de USD: `+1` é exato, não estimado. A de tokens continua sendo estimativa. Isso limita a ultrapassagem a `(chamadas em voo) × (estimativa de tokens)`, e a **zero** em requisições — que é justamente a dimensão em que o Free Tier costuma ser mais restritivo.

*Alternativa mais barata, registrada:* verificar apenas o consumo já contabilizado antes de chamar, aceitando ultrapassagem de `(chamadas em voo)` e compensando com teto abaixo do real. Defensável no volume do piloto; recomendo a reserva porque é um statement SQL e elimina a classe inteira de surpresa.

**Implementação real, reconciliada com D8.** Duas diferenças deliberadas do rascunho acima, registradas para não parecerem desvio silencioso:
1. **Sem estimativa de tokens na reserva.** O rascunho previa reservar `reservedTokens += :estimate` por tipo de operação — mas qualquer "estimativa conservadora" seria, ela mesma, um número inventado sem base empírica, exatamente o que D8 proíbe. Como não há teto de tokens configurado, não há contra o que comparar uma estimativa: a reserva cobre só `reservedRequests`; tokens entram apenas na reconciliação, com o valor **real** de `usageMetadata` — nunca estimados antecipadamente.
2. **Transação real do Postgres, não um único statement.** A reserva precisa ser tudo-ou-nada entre **dois** escopos (global e usuário) — um único `INSERT ... ON CONFLICT` cobre um escopo por vez. A implementação usa `prisma.$transaction` envolvendo os dois upserts: se o escopo do usuário exceder o teto depois do global já ter sido incrementado, o rollback nativo da transação desfaz os dois — sem decremento manual compensatório, sem classe de bug "esqueci de devolver a reserva do outro escopo".

*Fail-closed — três casos, todos recusam:* (a) **modelo sem entrada em `MODEL_PRICING`** — não porque haja dinheiro em jogo, mas porque significa que o modelo mudou sem que a contabilidade fosse revista, e a estimativa de tokens perderia base; (b) **falha ao ler ou escrever o ledger**; (c) teto interno atingido. Esta é uma **inversão deliberada** da política best-effort da telemetria, e as duas políticas convivem lado a lado no mesmo fluxo de upload:

| Registro | Se a escrita falhar | Por quê |
|---|---|---|
| `ai_usage_ledger` (P4-02) | **a chamada de IA é recusada** — 503 | não se autoriza consumo sem conseguir contabilizá-lo |
| `ai_call_events` (P3-01) | a operação segue normalmente | observabilidade não pode reverter negócio |

A distinção precisa estar **escrita no código**, não apenas neste documento: o ledger não usa `recordAiTelemetryBestEffort` nem nenhum wrapper que engula exceção.

#### Kill switch — separado do teto *(r3)*

A r2 sobrecarregava `GEMINI_DAILY_BUDGET_USD=0` com dois significados. **Isso não sobrevive à decisão de `paid budget = USD 0`**, que passaria a ser lida pelo sistema como "IA permanentemente desligada" — o oposto do pretendido. As duas responsabilidades passam a ter configurações distintas, e os **quatro estados** exigidos ficam explicitamente distinguíveis:

| Estado | Como é representado | Comportamento |
|---|---|---|
| **A — IA habilitada usando capacidade gratuita** | `GEMINI_ENABLED=true` e tetos internos não atingidos | operação normal |
| **B — IA desabilitada pelo operador** | `GEMINI_ENABLED=false` | nenhuma chamada; upload recusado com mensagem de indisponibilidade **deliberada**; resto do sistema intacto |
| **C — cota indisponível ou esgotada** | teto interno atingido, **ou** `429 RESOURCE_EXHAUSTED` do provedor | degradê controlado, `Retry-After` até a virada do período |
| **D — operação que poderia gerar cobrança** | **estruturalmente impossível** — chave de projeto sem billing (questão 7) | não existe caminho para este estado durante o piloto |

`GEMINI_ENABLED` segue o padrão de `env.ts`: validado no boot, com função de parse dedicada (as existentes são `parsePort`, `parseIntegerInRange`, `parseDecimalInRange`, `parseCorsAllowedOrigins`), default `true`, sem fallback silencioso. **Alternável sem novo deploy**, pela configuração de ambiente do Render.

*Comportamento ao esgotar:*

| Situação | Status | Justificativa |
|---|---|---|
| **B** — desabilitado pelo operador | **`503`**, sem `Retry-After` | não há previsão de retorno; é decisão humana, não janela de tempo |
| **C** — teto **global** de cota atingido | **`503`** + `Retry-After` até a virada do período | a capacidade está genuinamente indisponível para todos |
| **C** — teto **por usuário** atingido | **`429`** + `Retry-After` | é o limite deste cliente; semântica idêntica ao rate limit que a API já usa |
| **C** — `429` de cota do provedor apesar dos tetos internos | **`503`** + `Retry-After` | nosso teto estava mal calibrado; sinal para o runbook |
| Ledger indisponível / modelo sem preço | **`503`** | indisponibilidade real de uma pré-condição |

`402` foi descartado: sugere ao cliente que *ele* deve pagar algo, o que é falso — e sob `paid budget = USD 0` seria duplamente falso.

*Escopo preservado em todos os estados:* login, discovery, `GET /products`, `GET /suggestions` e **`confirm`/`reject`** continuam funcionando (verificado: nenhum dos dois chama IA). Isto importa mais sob Free Tier do que sob orçamento pago — com a cota diária esgotada, a coorte ainda consegue **decidir as sugestões pendentes que já existem**, que é justamente o trabalho humano que o piloto quer observar.

*Medição:* chamadas que falham geralmente não trazem `usageMetadata`, então o consumo de **tokens** fica subestimado; o de **requisições**, não — cada tentativa conta. Como `GEMINI_MAX_ATTEMPTS=2`, uma chamada pode consumir **duas** requisições da cota, e a reserva precisa considerar isso. O teto interno deve incluir margem; a magnitude real da subestimação é medida por P3-04.

| | |
|---|---|
| **Dependências** | ✅ **Gate operacional satisfeito** — limites reais lidos no AI Studio e registrados em D8. P4-01 (cauda por requisição limitada) ✅. Não depende de P3-01 — o ledger é registro próprio, com escrita forte. Os **valores** de teto do modo B permanecem **DEFERRED_WITH_GATE (D4)** e não bloqueiam a implementação |
| **Esforço** | **M** |
| **Risco** | **Médio** — um bug aqui pode negar serviço legítimo. Mitigado por teto configurável, por logar toda recusa com o motivo, e por não afetar nenhuma operação não-IA. |
| **Prioridade** | **P0** |
| **Impacto** | Converte um risco de indisponibilidade compartilhada, hoje sem limite superior, em números escolhidos conscientemente — e separa "desligado" de "sem cota". |

**Critérios de aceite — todos cumpridos. Dois foram reconciliados com D8 (registrado abaixo do critério, não silenciosamente).**
1. ✅ Com o consumo abaixo dos tetos, upload funciona normalmente (**estado A**).
2. ✅ Com o teto global de cota atingido, upload devolve `503` + `Retry-After`, **sem** chamar o Gemini; login/discovery/produtos/sugestões/confirm/reject nunca chamam IA, preservados por não tocarem `GeminiAiProvider` (**estado C**).
3. ✅ Com o teto por usuário atingido, aquele usuário recebe `429` e **outro usuário continua operando** — provado com dado real no gate PostgreSQL.
4. ✅ **`GEMINI_ENABLED=false` bloqueia toda operação de IA sem afetar o resto** (**estado B**), distinguível de C (sem `Retry-After`, motivo diferente no log).
5. ✅ Modelo sem preço em `MODEL_PRICING` faz a operação de IA ser recusada, não permitida — teste unitário prova que `GEMINI_MODEL` corrente (`gemini-2.5-flash`) tem entrada de preço.
6. **Reconciliado com D8.** O texto original assumia teto configurado também em tokens. D8 decide tokens **sem teto** nesta primeira versão — não há "teto + estimativa" para não ultrapassar nessa dimensão, e nenhuma reserva de tokens é feita (nada a estimar sem base empírica, ver D8). O que permanece e foi provado: **requisições nunca ultrapassam o teto sob concorrência real** — duas reservas simultâneas no limite exato produzem exatamente uma aceita e uma recusada (gate PostgreSQL). Tokens continuam **observados** (`ai_call_events`, P3-01, e `spentTokens` do próprio ledger), nunca limitados.
7. ✅ A reserva é liberada quando a chamada falha ou quando é recusada antes de acontecer (rollback de transação real — nenhum decremento manual compensatório, nenhuma classe de vazamento a testar separadamente).
8. ✅ Toda recusa é logada com escopo, estado (B ou C) e motivo — sem segredo.
9. ✅ **Falha de escrita no ledger recusa a chamada** (503) — testado com o ledger rejeitando, provando que o Gemini **não** é chamado.
10. ✅ **O ledger não lê `ai_call_events` em nenhum caminho**, e sua escrita não passa por nenhum wrapper best-effort — confirmado por grep, ausência de qualquer referência a `aiCallEvent`/`recordAiTelemetryBestEffort` em `prisma-ai-usage-ledger.repository.ts`/`ai-budget-guard.ts`.
11. ✅ **`429` deixa de disparar retry, incondicionalmente.** Na prática, não existe forma confiável de distinguir throttling de janela curta de cota diária esgotada a partir do que a API devolve — a tarefa já previa isso como comportamento conservador aceitável, e foi o adotado. `429` classificado como indisponibilidade (`503`) sem segunda tentativa.
12. ✅ Cada tentativa HTTP conta como uma requisição no ledger — provado com um retry de 2 tentativas debitando 2 reservas.
13. **Reconciliado com D8 — deliberadamente não testado, não abandonado.** Modo B (custo) segue `DEFERRED_WITH_GATE` (D4); testar "habilitável por configuração" exigiria valores de teto de custo que ninguém decidiu. As colunas (`reservedCostUsdNanos`/`spentCostUsdNanos`) e o mecanismo de dimensão-ausente-é-ilimitada já existem e foram *usados* para tokens nesta própria tarefa — a prova de que o mecanismo generaliza é a prática, não um teste adicional especulativo para um modo ainda sem números.
14. ✅ O ledger acumula `spentCostUsdNanos` **desde o modo A**, ainda que sem teto — provado no gate.

**Testes.** Unitário do guard (`AiBudgetGuard`): kill switch, checagem de preço, reserva/recusa/log por escopo, reconciliação best-effort só depois da chamada já ter ocorrido. Unitário da integração `GeminiAiProvider` × guard: kill switch bloqueia antes de qualquer reserva; reserva por tentativa (retry conta 2); rejeição no meio do retry aborta sem nova tentativa; reconciliação com tokens reais no sucesso e outcome vazio na falha. Unitário do `env.ts`: `GEMINI_ENABLED`, tetos de requisições com faixa 1–20 (nunca configurável acima do RPD real), e a ausência estrutural de qualquer variável de teto de tokens. **Gate PostgreSQL real**: reserva/reconciliação atômica; boundary 17→18 aceito, 19 recusado (global); boundary 4→5 aceito, 6 recusado (usuário), outro usuário não afetado; **concorrência real** — duas reservas simultâneas no limite exato nunca produzem duas aceitas; rollover de período diário.

**Fora de escopo (respeitado).** Teto por empresa. **Habilitar billing no projeto Google** — ação operacional do gate P6-00, não desta tarefa. Configuração do console Google (gate + runbook de P5-05, não código). Circuit breaker por taxa de falha. Fila/backpressure de uploads. Cobrança de usuário. **Reconciliação — é P3-04**, agora tecnicamente desbloqueada (`ai_usage_ledger` existe), mas **não iniciada nesta tarefa**, por instrução explícita de parar no checkpoint de P4-02. Definir os **valores** de orçamento do modo B — **DEFERRED_WITH_GATE (D4)**. Definir um teto de tokens — **DEFERRED_WITH_GATE (D8)**, aguardando telemetria real do piloto.

---

### P4-03 · Controle de cadastro e de criação de empresa durante o piloto

**Status: CONCLUÍDA em 2026-08-28.**

**Evidência de validação.** RED: `register-user.spec.ts` ganhou um `describe` dedicado provando que código incorreto e código ausente convergem para o **mesmo** `AppError` (status e mensagem idênticos) e que códigos de tamanhos diferentes não lançam exceção não tratada; `env.spec.ts` ganhou o caso `INVITE_CODE` (ausente, curto, válido); `logger.spec.ts` estendeu o teste de redação com as três grafias (`inviteCode`/`invite_code`/`invite-code`); `routes.rate-limit.spec.ts` ganhou o caso de `/companies` (5 permitidas, 6ª bloqueada); `routes.http.spec.ts` provou o encaminhamento do campo pelo controller.

GREEN: `RegisterUserUseCase` recebe `inviteCode` (do construtor, nunca lido de `env` internamente) e compara com o valor recebido via `crypto.timingSafeEqual` sobre **digests SHA-256** de ambos os valores — hashear antes de comparar elimina a exigência de mesmo comprimento do `timingSafeEqual` (que lançaria para strings de tamanhos diferentes) sem vazar o comprimento do valor recebido. `registerUserBodySchema` ganhou `inviteCode` **opcional** — ausência e valor incorreto caem na mesma recusa 403 do use case, sem distinção. `INVITE_CODE` em `env.ts` (obrigatória, mínimo 8 caracteres, mesmo padrão de `JWT_SECRET`). `invitecode` adicionado a `SENSITIVE_KEYS` do logger — `normalizeKey` já cobre as três grafias com uma entrada. Novo `createCompanyRateLimiter` (por usuário, 5/min, mesmo padrão de `uploadRateLimiter`) em `POST /companies`.

**Achado durante a validação, corrigido antes do commit:** os gates locais passaram na primeira tentativa só porque o `.env` de desenvolvimento (via `dotenv/config`, carregado por `env.ts`) fornecia um `INVITE_CODE` de fallback — mascarando que `.github/workflows/ci.yml` (os dois jobs), `scripts/postgres-integration.mjs` e `scripts/verify-production-runtime.mjs` **não** definiam a variável, o que quebraria em CI real (sem `.env`). Confirmado ocultando o `.env` local temporariamente (restaurado logo em seguida) e rodando `verify:production` e o gate PostgreSQL com `INVITE_CODE` ausente do shell: falharam antes da correção, passaram depois. Os três arquivos e `test/integration/setup.ts` foram atualizados com o mesmo padrão de fallback sintético já usado para `JWT_SECRET`/`GEMINI_API_KEY`.

Validação completa: `prisma generate`/`validate` ✅ (sem mudança de schema) · `typecheck` limpo · `lint` 0 problemas · suíte **422 → 432** (+10) · **PostgreSQL Integration Gate 39/39** (sem regressão; confirmado também sem `.env`/variáveis no shell) · `build` ✅ · `verify:production` ✅ (idem) · `git diff --check` limpo.

**Problema.** `POST /users` é público (5 contas/hora/IP, sem verificação de e-mail) e `POST /companies` **não tem rate limit nenhum**. O teto por usuário de P4-02 é contornável criando contas; o teto global protege o dinheiro, mas o piloto perde a propriedade que o define — coorte conhecida e controlada.

**Objetivo.** Durante o piloto, só participantes previstos conseguem criar conta, e nenhum usuário consegue criar empresas em volume anômalo.

**Descrição — decisão tomada em P0-01: código de convite compartilhado.** Descartadas: cadastro aberto (anula a coorte), criação manual de todas as contas (obriga a transportar senha por canal inseguro) e allowlist de domínio (não serve a participantes de empresas distintas). O convite preserva o autosserviço — o participante define a própria senha — e é reversível por configuração ao fim do piloto.

**Contrato HTTP — verificado contra os padrões atuais da API.** Um campo a mais no corpo de `POST /users`, sem cabeçalho customizado e sem rota nova:

```
POST /users   { "name": "...", "email": "...", "password": "...", "inviteCode": "..." }
```

`registerUserBodySchema` é `z.strictObject` (`http.schemas.ts:13`) — campo desconhecido é rejeitado, então **o campo precisa entrar no schema**; não há como enviá-lo "por fora".

**Detalhe de projeto que evita um vazamento sutil:** se `inviteCode` for obrigatório no schema, a ausência dá `400 'Dados inválidos.'` e o código errado dá `403` — a diferença entre os dois **revela que existe uma política de convite**. Declarar o campo como **opcional no schema** e deixar ausência e valor incorreto caírem no **mesmo `403` genérico** elimina a distinção. É uma linha de schema, e é a diferença entre uma política discreta e uma anunciada.

**Onde a verificação mora.** No **use case**, não em middleware nem no controller: "quem pode se cadastrar" é regra de aplicação, e `use-cases/` é onde elas vivem por convenção do projeto. O código esperado é **injetado como dependência** de `RegisterUserUseCase` — não lido de `env` lá dentro —, seguindo o mesmo padrão de injeção manual em `routes.ts` e mantendo o caso de uso testável sem variável de ambiente.

**Comparação segura.** `crypto.timingSafeEqual` sobre digests de tamanho fixo dos dois valores (hash antes de comparar, para não vazar comprimento nem exigir strings de mesmo tamanho).

**Segredo novo — três lugares a tocar, todos já verificados:**

| Onde | O que muda |
|---|---|
| `src/config/env.ts` | nova variável obrigatória, validada no boot como as demais (comprimento mínimo, sem fallback silencioso) |
| `src/infra/logger.ts` | acrescentar `invitecode` a `SENSITIVE_KEYS`. `normalizeKey` remove não-alfanuméricos e minúsculas (`logger.ts:42`), então `inviteCode`, `invite_code` e `invite-code` normalizam todos para `invitecode` — **uma entrada cobre as três grafias** |
| `.env.example` | documentar **sem valor real** |

**Já resolvido pelo código atual, verificado:** `validate-request.ts:7` lança `AppError('Dados inválidos.', 400)` **sem ecoar o valor recebido** — diferente do padrão comum de devolver os `issues` do Zod. Se ecoasse, um erro de validação poderia refletir o código de convite de volta ao cliente e para dentro do log de erro. Nada a fazer; vale registrar que a garantia depende desse comportamento continuar assim.

**Troca de código sem deploy:** alterar a variável de ambiente no Render reinicia o serviço com o novo valor. Não requer alteração de código nem novo build.

Independentemente do convite, adicionar **rate limit por usuário a `POST /companies`**, no padrão de `uploadRateLimiter` (mantido da r2).

| | |
|---|---|
| **Dependências** | nenhuma — **política decidida em P0-01** |
| **Esforço** | **S** |
| **Risco** | **Baixo** — mas o segredo precisa ser reversível por configuração, sem novo deploy |
| **Prioridade** | **P0** |
| **Impacto** | Sem isto, "coorte controlada" é uma intenção, não uma propriedade do sistema. É também o que impede que o teto por usuário de P4-02 seja contornado criando contas. |

**Critérios de aceite.**
1. Cadastro com o código correto funciona; com código incorreto **ou ausente**, devolve **o mesmo `403`** com mensagem que não revela a existência da política.
2. O código é lido de configuração validada no boot; **nunca versionado** — `.env.example` documenta a variável sem valor.
3. Comparação em tempo constante.
4. **O código não aparece em nenhum log**, em nenhum nível, nem em contexto de erro — teste explícito com `invitecode` em `SENSITIVE_KEYS`.
5. Trocar o código exige apenas alterar a variável de ambiente.
6. O rate limit existente de `POST /users` (5/h por IP) **permanece intacto**.
7. `POST /companies` passa a ter rate limit por usuário.
8. A proteção é removível ao fim do piloto sem cirurgia — a reversão é uma decisão de configuração e a remoção do campo do schema, nada mais.

**Testes esperados.** Unitário do use case para código correto, incorreto e ausente (os dois últimos indistinguíveis na resposta); teste de que a comparação não usa `===` sobre o valor cru; teste de rota confirmando `403` e a preservação do rate limit; teste do logger provando a redação de `inviteCode`; teste de rate limit em `/companies`.

**Fora de escopo.** Convites individuais. Tabela `Invite`. Expiração por convite. Envio por e-mail. Painel de administração. Papéis administrativos. Verificação de e-mail. **É deliberadamente um shared secret de entrada para uma coorte pequena.**

---

# P5 — Deployment readiness

### P5-01 · Artefato de deploy e estratégia de migration

**Status: PARCIALMENTE PREPARADA — NÃO concluída.** Conta Render (`docscan-api`) + Neon provisionadas e o **primeiro deploy real foi tentado em 2026-09-02**: falhou no build command (`tsc` — `TS2305`, `@prisma/client` sem os tipos gerados do schema), porque o comando documentado nunca rodava `prisma generate` antes de `tsc`. **Causa raiz confirmada por reprodução em checkout limpo (r22)** e corrigida no repositório (`npm run render:build`, novo, com guarda de regressão em CI) — mas **o deploy no Render ainda não foi reexecutado com a correção**; `/health`/`SIGTERM` contra o ambiente real seguem não verificados.

**O que foi feito nesta rodada (sem deploy real):**
- `prisma.config.ts` desacoplado de `src/config/env.ts` — passa a ler só `DATABASE_URL` via `resolveDatabaseUrl` (`src/config/database-url.ts`, novo), sem exigir `JWT_SECRET`/`GEMINI_API_KEY`. Verificado na prática (não só em teste): `env -u JWT_SECRET -u GEMINI_API_KEY DATABASE_URL=... npx prisma validate` roda com sucesso; sem `DATABASE_URL`, falha com a mesma mensagem clara de antes.
- Build/start commands documentados no README (`## Deploy (Render + Neon)`): build `npm ci && npm run render:build` (script novo, r22 — encapsula `prisma:generate && build && migrate deploy` numa única fonte de verdade); start `npm start`.
- Decisão "sem Dockerfile" registrada com a justificativa (runtime nativo já validado por `verify:production`).
- Política expand/contract registrada como **obrigatória** (não recomendada), com a razão: migration roda no build, antes do tráfego novo, e não é desfeita por rollback.

**O que continua faltando, e por que não avancei sozinho:** provisionar a conta Render + Neon (credenciais, criação de recursos), conectar `DATABASE_URL` real, executar o primeiro deploy, e verificar `/health`/`SIGTERM` contra o ambiente real. Nenhum desses passos é uma decisão técnica local — são ações em sistema externo que exigem acesso que este agente não tem e não deve obter sozinho.

**Problema.** Não existe Dockerfile nem qualquer artefato de deploy. E três obstáculos concretos impedem que o deploy "óbvio" funcione: `prisma` é `devDependency` (some no `npm prune --omit=dev`, e com ela `prisma migrate deploy`); `prisma.config.ts` importa `src/config/env.js` e portanto exige `GEMINI_API_KEY` só para rodar migration; e `tsc` emite ao lado do fonte com os `.js` commitados, de modo que um deploy que não reconstrói pode subir artefato obsoleto **sem nenhum erro**.

**Objetivo.** Um comando reprodutível que constrói e sobe a aplicação na plataforma escolhida, com migrations aplicadas de forma explícita e ordenada.

**Descrição — concreta para Render Free** *(r3)*.

**Dockerfile não é necessário.** O runtime nativo Node do Render usa build e start commands, e a r1 já validava o grafo de produção com `npm prune --omit=dev` + `verify:production`. Adotar Dockerfile aqui acrescentaria uma superfície a manter sem resolver nada que o runtime nativo não resolva. *Registro para revisitar:* se um dia o build precisar de binário de sistema (não é o caso hoje), o Dockerfile volta à mesa.

**Migration — a restrição que define o desenho.** O **Pre-Deploy Command é exclusivo de planos pagos**; no Free, a migration tem de ir no **build command**. Isso tem um efeito colateral favorável e um desfavorável, ambos precisam estar escritos:

- ✅ **Resolve o obstáculo da r1** de que `prisma` é `devDependency` e sumiria com `npm prune`: o build instala devDependencies, então o CLI existe ali. O que a r1 tratava como problema de empacotamento era, na verdade, um problema de *onde* rodar a migration.
- ⚠️ **A migration é aplicada antes de a nova versão entrar em tráfego e não é desfeita por rollback.** Torna a política **expand/contract obrigatória, não recomendada**: toda migration precisa ser compatível com a versão anterior da aplicação, porque a versão anterior pode voltar a rodar contra o schema novo. Verificado: nenhuma das 9 migrations existentes nem das propostas neste roadmap viola isso.

Forma esperada — build: `npm ci && npm run render:build`; start: `npm start`. **Correção r22:** a forma originalmente documentada (`npm ci && npm run build && npx prisma migrate deploy`) faltava `prisma generate` antes de `tsc` — sem ele, `@prisma/client` é só o pacote-placeholder do schema (nenhum tipo de modelo gerado), e o build falha com `TS2305` em checkout limpo. `npm run render:build` (novo script) resolve rodando `prisma:generate && build && migrate deploy` como uma única fonte de verdade, sem duplicar a sequência em README/roadmap/CI.

**Desacoplar `prisma.config.ts` de `src/config/env.ts`.** Hoje ele importa `./src/config/env.js` (`prisma.config.ts:2`), que exige `JWT_SECRET` e `GEMINI_API_KEY` além de `DATABASE_URL`. No build do Render as três variáveis existem, então **funcionaria assim mesmo** — mas manter o acoplamento significa que rodar migration passa a exigir a chave do Gemini, inclusive quando o operador rodar da máquina dele. Ler `DATABASE_URL` diretamente no config do Prisma é uma linha e remove a dependência.

**Artefato compilado.** O build roda `npm run build` explicitamente, então o start nunca depende dos `.js` commitados estarem atualizados. P5-06 continua sendo a rede de segurança para o inverso — divergência entrando no repositório.

| | |
|---|---|
| **Dependências** | **P0-01 — satisfeita** (Render + Neon decididos) |
| **Esforço** | **M** |
| **Risco** | **Médio** — é a primeira vez que o sistema roda fora do CI |
| **Prioridade** | **P0** |
| **Impacto** | Sem isto não há piloto. |

**Critérios de aceite.**
1. [x] Build reprodutível a partir de checkout limpo, com build e start commands documentados no repositório; **sem Dockerfile**, com a justificativa registrada. — **Corrigido em r22**: o comando documentado até então (`npm ci && npm run build && npx prisma migrate deploy`) **não era** reprodutível em checkout limpo — faltava `prisma generate` antes de `tsc`, e isso só foi descoberto no primeiro deploy real. `npm run render:build` verificado por reprodução real em clone limpo (A: falha sem `prisma generate`; B: passa com ele) e guardado por job de CI dedicado (`render-build-command`) que roda o comando exato a partir de checkout novo, contra Postgres efêmero.
2. [ ] `prisma migrate deploy` roda no build command e é idempotente em base já migrada. — comando é padrão e idempotente por design do Prisma; verificado nesta rodada (r22) que `migrate deploy` independe de `prisma generate` já ter rodado (testado isoladamente contra Postgres local efêmero, sem cliente gerado); ainda não verificado no build real do Render com a correção aplicada.
3. [ ] `prisma migrate status` limpo contra o Neon após o deploy. — exige conta Neon real.
4. [x] O passo de migration **não exige `GEMINI_API_KEY`** — verificado: `env -u JWT_SECRET -u GEMINI_API_KEY DATABASE_URL=... npx prisma validate` roda com sucesso.
5. [ ] `DATABASE_URL` aponta para a string *pooled* do Neon com `sslmode=require`, e a aplicação conecta. — exige conta Neon real.
6. [ ] A aplicação sobe, responde `/health` 200 e desliga com **exit 0** ao receber `SIGTERM` no ambiente real. — exige conta Render real.
7. [x] **Política expand/contract registrada como obrigatória**, com a razão (migration no build não é revertida por rollback).

**Testes esperados.** Execução do build no CI; boot do artefato contra Postgres efêmero com `/health` 200 e `SIGTERM` → exit 0 (extensão do `verify-production-runtime.mjs` existente); primeiro deploy real no Render como verificação de ponta a ponta.
**Fora de escopo.** Múltiplas instâncias. Autoscaling. CDN. Blue/green. Pipeline de CD automático — o deploy do piloto pode ser manual e deliberado. Dockerfile.

---

### P5-02 · Configuração de produção verificada empiricamente

**Problema.** `TRUST_PROXY_HOPS` default `0` atrás de um proxy real produz **uma única chave de rate limit para todo o tráfego** (todos limitados juntos); um valor alto demais faz a aplicação confiar em `X-Forwarded-For` forjado, e o rate limit vira ornamento. Nenhum dos dois erros produz mensagem. `CORS_ALLOWED_ORIGINS` depende de existir frontend. `/health` é público, sem limite, e toca o pool de 10 conexões.

**Objetivo.** Cada variável sensível de rede tem o valor correto **para a plataforma escolhida**, verificado por observação, não por leitura de documentação.

**Descrição — concreta para Render** *(r3)*.

**`TRUST_PROXY_HOPS`.** O Render termina TLS e encaminha por proxy próprio, então o default `0` está **errado** para este ambiente: `configureTrustProxy` mapeia `0 → false` (`trust-proxy.ts:4`), e o Express passa a usar o IP do proxy como `req.ip` para **todo mundo** — colapsando os rate limits de login, cadastro e upload numa única chave compartilhada. Começar por **`1`** e **verificar empiricamente**, porque o número correto depende de haver ou não outra camada (ex.: CDN) na frente:

- (a) dois clientes de IPs distintos são limitados **de forma independente**;
- (b) um cliente que envia `X-Forwarded-For` forjado **não** escapa do limite.

O teste (b) é o que distingue "hops correto" de "hops alto demais", e nenhum dos dois erros produz mensagem — por isso a verificação é observacional, não documental.

**CORS — decidido em P0-01: sem frontend.** Comportamento atual verificado: `origin === undefined || allowlist.has(origin)` (`http-security.ts:18`). Requisições **sem cabeçalho `Origin`** — exatamente o caso de `curl`, Insomnia e Postman — **já passam** com a allowlist vazia. Portanto: **manter `CORS_ALLOWED_ORIGINS` vazia**, que é o default.

Três consequências, todas deliberadas: não se configura origem fictícia só para "ter CORS configurado"; **o CORS não é removido do projeto** — a allowlist vazia é uma configuração válida e restritiva, não uma ausência; e quando houver frontend, adicionar sua origem é **uma variável de ambiente**, sem redesenho. Registrar a decisão e o motivo é parte da tarefa: uma allowlist vazia sem explicação parece esquecimento na próxima leitura.

**HTTPS/TLS.** Fornecido e gerenciado pelo Render, inclusive em domínio customizado. Nada a fazer na aplicação — e nada a assumir sobre terminação TLS no processo Node.

**⚠️ `SHUTDOWN_TIMEOUT_MS` × prazo do Render.** Ambos valem **30 s** por default (`env.ts:89` e o `maxShutdownDelaySeconds` da plataforma). No empate, a plataforma pode enviar `SIGKILL` exatamente enquanto o `runShutdown` de `server-lifecycle.ts` ainda drena — e o graceful shutdown construído em M4-01 registraria falha sem que houvesse falha. Configurar a aplicação **abaixo** do prazo da plataforma (ex.: `SHUTDOWN_TIMEOUT_MS=20000` contra 30 s do Render), para que ela sempre termine primeiro e por decisão própria.

**Segredos.** Todos injetados pelo painel do Render: `DATABASE_URL`, `JWT_SECRET` (≥ 32 caracteres, P2-01), `GEMINI_API_KEY` (de projeto **sem billing**, P4-02), o código de convite (P4-03) e `GEMINI_ENABLED`. Nenhum em arquivo versionado.

**`/health` sob cold start duplo.** Render dorme após 15 min e Neon após 5. `/health` faz `SELECT 1` real, então a primeira chamada após ociosidade paga os dois cold starts. Um healthcheck de plataforma com timeout curto pode marcar o serviço como não saudável **sem falha real**. Manter o rate limit/cache curto já previsto (protege o pool de 10 conexões) e dimensionar o timeout do healthcheck acima do cold start observado — medido, não estimado.

| | |
|---|---|
| **Dependências** | P5-01; P2-01 para o requisito do segredo; P4-03 para o segredo do convite |
| **Esforço** | **S** |
| **Risco** | **Médio** — o erro aqui é silencioso e desativa uma proteção que aparenta estar ativa |
| **Prioridade** | **P0** |
| **Impacto** | Rate limiting é a única defesa entre o cadastro e o consumo da cota compartilhada. Configurado errado, ele não existe. |

**Critérios de aceite.**
1. Os dois testes empíricos de proxy passam contra o Render real, com evidência registrada.
2. `CORS_ALLOWED_ORIGINS` **vazia**, com a decisão e o motivo registrados; um cliente HTTP sem `Origin` opera normalmente.
3. `SHUTDOWN_TIMEOUT_MS` **estritamente menor** que o prazo de shutdown do Render, e um `SIGTERM` real produz **exit 0**, não `SIGKILL`.
4. Nenhum segredo em arquivo versionado (varredura executada); todos no painel do Render.
5. `JWT_SECRET` de produção com entropia adequada.
6. `/health` protegido contra flood e **funcional após spin-down** — cold start medido e o timeout do healthcheck ajustado acima dele.

**Testes esperados.** Verificação manual documentada contra o ambiente real (não automatizável sem o proxy real); teste automatizado do rate limit de `/health`; observação cronometrada de um ciclo spin-down → primeira requisição.
**Fora de escopo.** WAF. mTLS. IP allowlisting. Rate limit distribuído (instância única). **Configurar CORS para frontend inexistente.**

---

### P5-03 · Backup com restore ensaiado e cronometrado

**Problema.** Não há backup configurado. Perda de banco no piloto é perda total de dado fiscal e de toda a telemetria que justifica o piloto. É o **único** erro deste roadmap que não se corrige depois.

**Objetivo.** Existe uma prova executada, datada e cronometrada de que o banco pode ser restaurado.

**Descrição — concreta para Neon Free** *(r3)*.

**O que o Neon Free dá sozinho:** restore instantâneo por branch com **janela de histórico de 6 horas**, teto de 1 GB de histórico, sem custo.

**Por que isso não basta, e o requisito não foi relaxado.** Seis horas cobrem apenas o incidente **detectado no mesmo turno**. Uma corrupção lógica notada no dia seguinte — o caso mais comum num piloto com uso intermitente — já está fora da janela. Reduzir P5-03 a "o Neon tem backup" seria exatamente o que o próprio roadmap proíbe: confundir *existência de backup* com *capacidade de recuperação comprovada*.

**Solução mínima complementar, gratuita:** `pg_dump` lógico executado **pelo operador, da máquina dele**, contra a `DATABASE_URL` do Neon, com cadência diária durante a janela do piloto e uma execução obrigatória antes de cada deploy que inclua migration. É gratuito, não depende de recurso pago de nenhum provedor, e cobre o intervalo que o PITR de 6 h não cobre.

*Alternativa considerada e não recomendada como primária:* dump agendado por GitHub Actions guardando o artefato no CI. Automatiza, mas **coloca dump de dado fiscal de terceiros num artefato de CI** — troca um problema operacional por um de privacidade, no mesmo piloto em que a privacidade do dado já é assunto aberto (§13-A). Fica registrada como opção se a cadência manual não se sustentar, com a ressalva de exigir criptografia do dump e política de retenção do artefato.

**O padrão de evidência de §3.6 permanece integralmente.** Executar um **restore real para um banco novo e separado** — no Neon, uma branch dedicada, dentro do limite de 10 do plano Free, sem custo — e produzir, em `docs/backup-restore-evidence.md`: data e hora do ensaio; **RPO e RTO medidos**; `prisma migrate status` limpo no banco restaurado; contagem de linhas por tabela comparada com a origem; uma consulta de domínio real retornando dado coerente (`ProcessedInvoice` com seus produtos e sugestões). **Ambos os caminhos são ensaiados**: o restore por branch do Neon e o restore a partir do `pg_dump`. O ensaio é repetido em P6-02 com dado real do piloto.

| | |
|---|---|
| **Dependências** | P5-01 (banco de produção provisionado) |
| **Esforço** | **M** |
| **Risco** | **Baixo** para o sistema; **alto** se pulado |
| **Prioridade** | **P0** |
| **Impacto** | É a diferença entre um incidente recuperável e a perda do piloto inteiro. |

**Critérios de aceite.**
1. Janela de restore do Neon **confirmada e registrada em horas** — não presumida.
2. Procedimento de `pg_dump` documentado, executado ao menos uma vez, com o local de guarda do dump definido (fora do repositório).
3. **Restore executado por ambos os caminhos** — branch do Neon e `pg_dump` — para um banco novo e separado.
4. **RPO e RTO medidos e registrados para cada caminho** (os dois RPOs são diferentes por construção: ≤ 6 h no Neon, ≤ 24 h no dump).
5. Contagem de linhas conferida contra a origem; `prisma migrate status` limpo no restaurado; consulta de domínio coerente.
6. Tudo registrado com data em `docs/backup-restore-evidence.md`.

**Um backup não restaurado não satisfaz esta tarefa, e "o Neon tem PITR" não é restore.**

**Testes esperados.** O próprio ensaio é a evidência. Sem teste automatizado.
**Fora de escopo.** Replicação cross-region. Retenção de longo prazo além do piloto. Automação do dump (avaliada e adiada por privacidade — ver acima).

---

### P5-04 · Smoke test de deploy e procedimento de rollback

**Problema.** Sem verificação pós-deploy, uma versão quebrada só é descoberta por um participante do piloto. Sem rollback ensaiado, a resposta a isso é improvisada sob pressão.

**Objetivo.** Todo deploy é seguido de uma verificação automática do caminho crítico, e reverter é um procedimento conhecido.

**Descrição.** Script de smoke test executável contra o ambiente implantado, percorrendo o ciclo real com uma conta descartável: `POST /users` (**com o código de convite de P4-03**) → `POST /login` → `POST /companies` → **`GET /companies` → `GET /companies/:id/stocks`** → `GET /products`. **Não** inclui upload de nota: sob Free Tier, gastaria **cota compartilhada da coorte** a cada deploy — a razão da r1 era custo, e sob r3 a razão é mais forte, não mais fraca. O upload é verificado uma vez, manualmente, em P6-01.

**Primeira requisição após spin-down.** O smoke test roda contra um serviço possivelmente adormecido: o primeiro passo precisa tolerar ~1 min de cold start do Render somado ao do Neon, ou falhará por timeout sem que haja defeito. Um *warm-up* explícito contra `/health` antes de cronometrar qualquer coisa resolve.

**Rollback no Render** *(r3)*: reverter para um deploy anterior pelo painel, **limitado aos dois deploys mais recentes** — suficiente para o piloto, e um motivo a mais para deploys pequenos e frequentes em vez de grandes e raros. A política **expand/contract** deixa de ser recomendação e vira **obrigação**, porque a migration roda no build (P5-01) e **não é desfeita pelo rollback**: a versão anterior da aplicação voltará a rodar contra o schema novo. Verificado: nenhuma das 9 migrations existentes nem das propostas aqui é destrutiva.

| | |
|---|---|
| **Dependências** | P5-01, **P1-01, P1-02** (o smoke test usa as rotas de discovery) |
| **Esforço** | **S** |
| **Risco** | **Baixo** |
| **Prioridade** | **P1** |
| **Impacto** | Transforma "acho que subiu" em "verificado", e improviso em procedimento. |

**Critérios de aceite.** Smoke test roda contra o ambiente implantado e falha com saída não-zero se qualquer passo quebrar; **não consome cota de IA**; tolera cold start; não deixa dado residual (ou deixa dado claramente identificável como de teste, com limpeza documentada); runbook de rollback escrito e **executado uma vez** em ambiente real, registrando o limite de dois deploys; **política expand/contract registrada como obrigatória**, com a razão (migration no build).
**Testes esperados.** O script é o teste. Rollback exercitado ao menos uma vez.
**Fora de escopo.** Deploy automático em push. Canary. Testes de carga.

---

### P5-05 · Runbooks de operação do piloto

**Problema.** Hoje uma conta com senha esquecida é **permanentemente inacessível**: não há reset, não há admin, não há script. Essa é a única situação da tabela de §3.8 que precisa de ferramenta nova.

**⚠️ Restrição descoberta em r3 que muda onde as ferramentas rodam.** O **Render Free não oferece shell/SSH nem one-off jobs**. Os três scripts de operador deste roadmap — recuperação de conta (aqui), purga de retenção (P3-03) e reconciliação (P3-04) — **não têm onde executar na plataforma**.

A saída é boa e já está disponível: o Neon é um banco gerenciado **separado da aplicação**, acessível pela internet com TLS. Os scripts rodam **da máquina do operador**, apontando `DATABASE_URL` para o Neon. Consequências que precisam estar escritas antes de alguém precisar disso às pressas:

- o operador precisa de Node e do repositório na máquina — o mesmo ambiente de desenvolvimento já existente;
- a `DATABASE_URL` de produção passa a existir fora do Render, na máquina do operador. **Quem opera tem acesso direto ao banco de produção**, sem intermediação. Aceitável numa equipe de uma pessoa; precisa ser reavaliado se a equipe crescer, e está registrado como tal;
- não há trilha de auditoria de plataforma sobre essas execuções — motivo adicional para o script gravar em `AuditLog`, que já era exigido.

**Objetivo.** Cada situação previsível do piloto tem um procedimento escrito, a única que exige ferramenta tem a ferramenta, e está claro **onde** cada ferramenta roda.

**Descrição.** `docs/pilot-runbooks.md` cobrindo: (1) **recuperar conta travada** — script de operador em `scripts/` que redefine a senha de um usuário por e-mail usando o mesmo `Argon2HashProvider`, executado contra o banco de produção pelo operador, gravando `AuditLog` e, **após P2-02, incrementando `authVersion` para invalidar todos os tokens anteriores na mesma escrita**; **não é endpoint HTTP** — não há papel de administrador no modelo e criar um seria um subsistema de autorização inteiro para atender um caso raro numa coorte conhecida; (2) diagnosticar nota que falhou, via `X-Request-Id` da resposta e as consultas de P3-03; (3) localizar empresa/estoque de um usuário (via P1, sem SQL); (4) investigar falha do Gemini por `failureCategory`, **incluindo notas abortadas por `unavailable` após P0-02** — o operador precisa saber distinguir "a nota falhou porque o Gemini caiu" de "a nota é inválida", e orientar o reenvio; (5) responder ao esgotamento de orçamento — o que verificar, quando elevar o teto, como usar o kill switch; (6) restaurar o banco, referenciando a evidência de P5-03; (7) reverter deploy, referenciando P5-04; (8) configurar a cota do lado do Google como backstop; (9) **executar a reconciliação de P3-04 e interpretar cada classe de divergência**, incluindo o que fazer diante de reserva residual.

Se P2-02 **não** entrar no piloto, o script ainda funciona (redefine a senha), mas **não** invalida tokens anteriores — a coluna `authVersion` não existirá. Essa limitação precisa estar escrita no runbook, não descoberta durante um incidente.

**Dois runbooks acrescentados em r3**, decorrentes das plataformas escolhidas: **(10)** o que fazer quando o serviço parece fora do ar mas é apenas cold start de Render e/ou Neon — como distinguir sono de falha antes de escalar, incluindo o tempo esperado; **(11)** o que verificar quando o Gemini devolve `429` — se é a janela curta, se é a cota diária, se os tetos internos estavam mal calibrados, e o que **não** fazer (repetir a requisição, que consome mais cota da coorte). O runbook do estado de orçamento passa a cobrir os quatro estados A/B/C/D de P4-02 e a operação do `GEMINI_ENABLED`.

| | |
|---|---|
| **Dependências** | P1 (localização), P3-03 (consultas), **P3-04** (reconciliação), P4-02 (orçamento), P5-03, P5-04, **P0-02** (diagnóstico de nota abortada); **P2-02 se existir**, para a invalidação de token no reset |
| **Esforço** | **M** |
| **Risco** | **Médio** — o script de reset é uma ferramenta de escrita privilegiada; precisa de confirmação explícita e de registro em auditoria |
| **Prioridade** | **P0** (o item 1 é bloqueador) |
| **Impacto** | Remove o único estado irrecuperável de acesso do sistema e converte diagnóstico em procedimento. |

**Critérios de aceite.** O script de reset funciona contra um banco real, exige confirmação explícita do e-mail alvo, grava `AuditLog`, nunca imprime nem registra a senha, e recusa executar sem `DATABASE_URL` apontando para um banco explicitamente informado; **com P2-02 presente, incrementa `authVersion` e os tokens anteriores do usuário param de funcionar**; os **onze** runbooks existem e cada um foi percorrido ao menos uma vez; **cada um declara onde é executado** (máquina do operador × painel do Render × console do Google); nenhum runbook depende de conhecimento não escrito.
**Testes esperados.** Teste do script de reset no gate PostgreSQL (hash alterado, login antigo falha, login novo funciona, `AuditLog` gravado, **`authVersion` incrementada e token anterior rejeitado**).
**Fora de escopo.** Painel de administração. API de administração. Papel de admin no modelo de dados. Reset por e-mail. **Endpoint de revogação administrativa** — o mecanismo existe após P2-02, mas a superfície fica no script.

---

### P5-06 · Impedir deploy de artefato compilado obsoleto

**Status: CONCLUÍDA em 2026-08-28.**

**Evidência de validação.** RED: em `src/config/trust-proxy.ts`, uma linha de comentário foi adicionada sem regenerar `trust-proxy.js`; rodar `npm run build` reescreveu `trust-proxy.js`/`.d.ts.map`/`.js.map` a partir do `.ts` alterado, e `git status --porcelain` (a lógica do guard) mostrou os quatro arquivos divergentes do commit — prova de que o build produz uma diferença detectável quando fonte e artefato saem de sincronia. GREEN: alteração revertida (`git checkout -- src/config/trust-proxy.ts`), `npm run build` executado de novo, `git status --porcelain` voltou a vazio. A alteração artificial não permaneceu na árvore de trabalho.

**Decisão de desenho: `git status --porcelain`, não `git diff --exit-code`.** A descrição original desta tarefa sugeria `git diff --exit-code`, que cobre artefato *modificado*. Mas `git diff` (sem `--`) não enxerga arquivo **novo e não rastreado** — o caso de um `.ts` novo cujo `.js`/`.d.ts` nunca chegou a ser gerado/commitado, que é a mesma classe de defeito (artefato commitado, ou ausente, divergente do fonte) e está dentro do objetivo declarado ("qualquer outro artefato compilado versionado pelo projeto"). `git status --porcelain` cobre os dois casos com o mesmo comando, sem lista manual de extensões.

**Novo script:** `scripts/verify-build-artifacts.mjs` (`npm run verify:artifacts`) — roda `git status --porcelain` via `spawnSync`, falha com a lista de arquivos divergentes e uma instrução (`rode npm run build antes de commit`) se houver qualquer entrada; passa silenciosamente (mensagem de sucesso) se a árvore estiver limpa. Adicionado ao job `verify` do CI, logo após `lint` e antes de `npm test` — falha rápido, antes do custo da suíte e do gate PostgreSQL, e evita duplicar a checagem no job `production-runtime` (que já builda, mas serve a um propósito diferente: validar o grafo de dependências só com `dependencies`).

**Ruído CRLF local (Windows) não afeta o CI.** No ambiente de desenvolvimento (`core.autocrlf=true` do Git para Windows, configuração global da máquina, não do repositório), `prisma.config.*`/`vitest*.config.*` aparecem como modificados após qualquer `npm run build`, mesmo sem alteração real — confirmado com `git diff --stat` retornando vazio para esses arquivos apesar do `git status` marcá-los como `M`. GitHub Actions roda `ubuntu-latest`, onde essa conversão não acontece; o guard não precisou de nenhuma exceção para esses arquivos porque o problema é exclusivamente local. Nenhum `.gitattributes` foi adicionado — o CLAUDE.md pede o comportamento correto do CI, não a normalização de quirks locais do Windows.

**Problema.** `tsc` emite ao lado do fonte e os `.js` são commitados; `npm start` executa `node src/index.js`. Um `.ts` alterado sem rebuild produz um artefato divergente do fonte, sem erro. O próprio README alerta que a suíte pode resolver o arquivo compilado desatualizado — ou seja, o risco já se materializou nos testes e nada impede que se materialize em produção.

**Objetivo.** É impossível que o artefato commitado divirja do fonte sem o CI acusar.

**Descrição.** Passo de CI que roda `npm run build` e falha se o working tree ficar sujo (`git diff --exit-code`), provando que os artefatos commitados correspondem ao fonte. Alternativa a avaliar dentro da tarefa: parar de commitar artefatos e passar a construir sempre (mais limpo, mas mexe na convenção de import `.js` documentada como deliberada — a decisão fica com quem executar, com justificativa registrada).

| | |
|---|---|
| **Dependências** | nenhuma |
| **Esforço** | **S** |
| **Risco** | **Baixo** — pode acusar divergência já existente hoje, o que é o objetivo |
| **Prioridade** | **P1** |
| **Impacto** | Fecha uma classe de falha silenciosa de correção, que é a prioridade 1 do CLAUDE.md. |

**Critérios de aceite.** CI falha quando um `.ts` é alterado sem rebuild; CI passa no estado consistente; a divergência atual (se houver) foi resolvida na tarefa.
**Testes esperados.** O passo de CI é o teste. Verificar com uma alteração deliberada em branch descartável.
**Fora de escopo.** Migrar para `outDir: dist`. Mudar convenção de import. Alterar a estratégia de testes.

---

# P6 — Piloto controlado

### P6-00 · REAL-DOCUMENT AI TIER GATE *(r4)*

**Gate reafirmado por D4 (2026-08-28, `docs/pilot-decisions.md`): Free Tier pilot = permitido. Paid commercial = bloqueado** até budget guard, teto diário e teto mensal explícitos existirem, calibrados com evidência real do piloto. Este gate (P6-00) é onde essa distinção é verificada operacionalmente antes de qualquer ativação comercial — nada muda no desenho abaixo, D4 apenas confirma e nomeia formalmente os dois lados da fronteira.

**Problema.** A resolução de §13-A separa os usos por tier: Free Tier para desenvolvimento com dado sintético, Paid Tier para DANFE real de terceiros. Uma separação que depende de alguém lembrar não é uma separação — e o modo de falha é silencioso: tudo funciona igual, e a diferença só aparece nos termos de uso do provedor.

**Objetivo.** Nenhum participante externo envia DANFE real antes de haver **evidência registrada** de que o ambiente implantado está no tier aprovado para esse uso.

**Descrição.** Verificação operacional, **não código**, executada e registrada antes de liberar acesso à coorte. O que importa é o **billing/tier do projeto da Gemini API efetivamente usado pelo backend implantado** — não a existência de uma assinatura pessoal, não o tier de outro projeto, não a intenção de migrar.

Nove verificações, todas com evidência:

1. **Qual projeto** da Gemini API o ambiente de piloto usa — identificado sem ambiguidade.
2. **Qual API key** está de fato implantada no Render — conferida contra o projeto acima, não presumida.
3. Confirmação de que esse projeto **não está mais operando sob a configuração Free** usada no desenvolvimento.
4. **Billing/tier adequado** confirmado no console do provedor.
5. **Política de dados do tier revisada** e registrada — é a razão de o gate existir.
6. **Budget financeiro configurado** (P4-02 modo B), com os valores de D4 — permanece DEFERRED_WITH_GATE até haver evidência real de custo do piloto.
7. **Kill switch verificado** no ambiente real: `GEMINI_ENABLED=false` interrompe chamadas e o resto da API segue.
8. **Teste controlado** executado com uma DANFE real, pelo operador, antes de qualquer terceiro.
9. **Evidência registrada** em `docs/pilot-decisions.md` ou arquivo próprio, com data e responsável.

**Se o gate falhar, P6 com DANFE real não começa.** Não há exceção parcial: não existe "só um participante para testar".

| | |
|---|---|
| **Dependências** | P4-02 (modo B configurável), P5 completo, valores de budget de D4 (**DEFERRED_WITH_GATE** — não bloqueia este gate em si, bloqueia a ativação comercial) |
| **Esforço** | **S** — é verificação, não construção |
| **Risco** | **Nenhum** para o sistema; é o controle que impede um risco |
| **Prioridade** | **P0** — **bloqueia P6-01** |
| **Impacto** | Transforma a resolução de §13-A de intenção em propriedade verificada. Sem ele, a separação por tier depende de memória. |

**Critérios de aceite.** As nove verificações executadas, cada uma com evidência registrada, data e responsável; o gate é **bloqueante** e está declarado como tal; nenhum acesso externo liberado antes da conclusão.
**Testes esperados.** Nenhum automatizado — é gate operacional. O item 7 reusa o teste de kill switch de P4-02, executado agora contra o ambiente real.
**Fora de escopo.** Implementar qualquer código. Definir os valores de budget — **DEFERRED_WITH_GATE (D4)**. Automatizar a verificação de tier — não há API documentada e a frequência é uma vez.

**Não bloqueia P0-02 até P5.** Todo o trabalho técnico prossegue no Free Tier com dado sintético.

---

### P6-01 · Provisionar coorte e ambiente e validar o ciclo real fim a fim

**Coorte confirmada em 2026-08-28 — D5 (`docs/pilot-decisions.md`): teto de 200 usuários cadastrados, não meta.** O piloto não precisa atingir 200 para ser válido; a suficiência é avaliada por evidência de uso real (usuários ativos, DANFEs processadas, decisões de matching, erros, consumo de cota — não só contagem de cadastro), não por número bruto atingido.

**Problema.** "Sistema implantado" e "sistema utilizável por pessoas reais" não são a mesma coisa. A verificação do upload real não pode acontecer no smoke test de cada deploy — custa orçamento de IA.

**Objetivo.** Ambiente pronto, contas criadas e **o ciclo completo executado uma vez com uma DANFE real** antes de a coorte entrar.

**Descrição.** Provisionar contas conforme a política de P4-03, **até o teto de 200 (D5)**; configurar tetos de orçamento conforme D4 (Modo A, Free Tier); executar manualmente, uma vez, o ciclo integral: login → `GET /companies` → `GET /companies/:id/stocks` → upload de **uma DANFE real** → conferir produtos → conferir sugestões → confirmar uma → rejeitar uma → verificar que os eventos de telemetria correspondentes existem no banco e que o custo foi contabilizado no orçamento. Enviar instruções de acesso à coorte e abrir um canal de registro de incidentes.

| | |
|---|---|
| **Dependências** | **todas as tarefas de P0–P5 marcadas P0**, **e o gate P6-00** — com destaque para **P0-02**, bloqueadora explícita: nenhuma nota real de terceiro entra no sistema enquanto uma falha de IA puder criar produto no catálogo dele |
| **Esforço** | **S** |
| **Risco** | **Baixo** |
| **Prioridade** | **P0** |
| **Impacto** | É o primeiro uso real do sistema. |

**Critérios de aceite.** Contas criadas e testadas; tetos configurados e observáveis; o ciclo completo executado com DANFE real, com **evidência registrada** de que os eventos de IA foram persistidos, o custo contabilizado no ledger e a decisão de sugestão registrada; **P0-02 em produção, verificada** — com o provider forçado a falhar num ambiente de teste, a nota é abortada e nenhum produto é criado; canal de incidentes ativo.
**Testes esperados.** Execução manual documentada.
**Fora de escopo.** Treinamento formal. Documentação de usuário final. SLA.

---

### P6-02 · Operar e observar a janela do piloto

**Janela confirmada em 2026-08-28 — D6 (`docs/pilot-decisions.md`): 4 semanas**, substituindo a faixa aberta de 2–4 semanas por um valor concreto. A regra de encerramento antecipado abaixo ("critérios objetivos de §12" ou "coorte não gera volume") continua valendo dentro dessas 4 semanas — D6 fixa o planejamento, não remove o critério de suficiência já registrado.

**Problema.** Sem uma janela definida e sem observação sistemática, o piloto vira uso casual e não produz nem os dados de M5-02/M6-02 nem confiança operacional.

**Objetivo.** Uma janela definida de uso real, com o comportamento observado, os incidentes registrados e o sistema exercitado nas condições que importam.

**Descrição.** Durante a janela de 4 semanas (D6): revisar diariamente as consultas de P3-03 (custo do dia, taxa de falha, latência p95, chamadas de similaridade por nota) **e rodar a reconciliação de P3-04**; registrar todo incidente com `correlationId`/`requestId`, sintoma, causa e resolução; **exercitar deliberadamente três cenários operacionais** — reiniciar a aplicação sob uso e confirmar que `/health` volta e nada se perde; repetir o ensaio de restore **agora com dado real** (P5-03 com dado vazio prova pouco); simular esgotamento de orçamento baixando o teto temporariamente e confirmar que upload degrada com o status correto enquanto login, discovery e confirm/reject seguem funcionando.

**Medição específica de P0-02.** A janela também produz o número que a r1 queria e não podia ter: **quantas notas foram abortadas por `unavailable`, e por qual `failureCategory`**. É esse número — e não a intuição — que decide em P6-03 se o estado `UNRESOLVED` (§10) passa a ter justificativa ou permanece adiado.

**Sobre metas numéricas.** Não invento um `N` de notas. O que a janela precisa produzir é **volume suficiente para as perguntas de §12**, e esse volume é uma consequência do uso real da coorte, não uma meta a perseguir. As quantidades mínimas de §12 são **sugestões para uma primeira leitura**, explicitamente rotuladas como tal. A **regra** é: a janela termina quando os critérios objetivos de §12 forem atendidos **ou** quando ficar claro que a coorte não gera esse volume — e neste segundo caso a conclusão é sobre a demanda, não sobre o sistema, e é um resultado tão válido quanto o outro.

| | |
|---|---|
| **Dependências** | P6-01 |
| **Esforço** | **L** (calendário: **4 semanas**, D6; carga diária baixa) |
| **Risco** | **Médio** — é o primeiro contato com dado real; espere achados |
| **Prioridade** | **P0** |
| **Impacto** | É o objetivo inteiro deste roadmap. |

**Critérios de aceite.** Revisão diária registrada; **reconciliação de P3-04 executada diariamente, com as divergências classificadas**; todos os incidentes com causa e resolução; os três cenários operacionais exercitados e documentados; **segundo ensaio de restore com dado real concluído**; nenhum incidente aberto sem dono ao fim da janela.
**Testes esperados.** Observação e registro; os cenários são exercícios em ambiente real.
**Fora de escopo.** Novas features durante a janela, salvo correção de defeito bloqueante. Expansão da coorte.

---

### P6-03 · Relatório de saída e desbloqueio de M5-02 / M6-02

**Problema.** Dado coletado e não interpretado não desbloqueia decisão nenhuma. M5-02 e as bandas de M6-02 continuariam bloqueadas indefinidamente.

**Objetivo.** Um relatório que responde às oito perguntas com número real e converte cada uma em decisão explícita: fazer, não fazer, ou continuar esperando.

**Descrição.** `docs/pilot-report.md` com o resultado das 8 consultas de P3-03 sobre a janela; a avaliação dos critérios objetivos de §12; e uma decisão declarada para **M5-02** (implementar batching / **fechar como não-compensa** / continuar bloqueada, com o número que sustenta a escolha) e para as **bandas de M6-02** (ajustar limiar / introduzir banda / manter 0.7, com a taxa de aceitação por faixa que sustenta). Registrar também o custo real por nota, a taxa de falha, o resultado acumulado da reconciliação (incluindo a divergência medida contra a fatura, que calibra a margem do teto) e os defeitos encontrados, como insumo do roadmap seguinte.

**Terceira decisão a declarar, nova em r2: o destino do estado `UNRESOLVED`.** Com a frequência de notas abortadas por `unavailable` em mãos, decidir explicitamente entre: manter o aborto de nota de P0-02 como comportamento definitivo (se a frequência for baixa); ou promover o estado `UNRESOLVED` (§10) a tarefa de roadmap (se o reprocessamento integral estiver custando caro ou irritando usuários). Também aqui, "manter como está" é resultado legítimo — e a decisão passa a ser tomada sobre um pipeline **já correto**, com a diferença sendo apenas o custo do reenvio, e não a integridade do catálogo.

| | |
|---|---|
| **Dependências** | P6-02 |
| **Esforço** | **S** |
| **Risco** | **Nenhum** — documento |
| **Prioridade** | **P0** |
| **Impacto** | É o que converte o piloto em decisão. Sem ele, o piloto vira anedota. |

**Critérios de aceite.** As 8 perguntas respondidas com número real; M5-02, M6-02 **e o destino de `UNRESOLVED`** com decisão explícita e sustentada por dado; **"fechar M5-02 como não-compensa" é um resultado aceitável e deve ser escolhido se o dado apontar nessa direção**; divergência acumulada da reconciliação registrada; defeitos e riscos residuais listados.
**Testes esperados.** Nenhum (documento).
**Fora de escopo.** Implementar M5-02 ou as bandas — são tarefas do backlog anterior, desbloqueadas por este relatório.

---

## 7. Dependências

| Tarefa | Depende de | Natureza |
|---|---|---|
| P0-01 | — | — (✅ concluída 2026-08-28) |
| **P0-02** | **—** | **independente** |
| P1-01 | — | independente |
| P1-02 | — | independente |
| P2-01 | — | independente |
| P2-02 | P2-01 (recomendado) | ordem preferencial. **P0, Must have (D3)** |
| P2-03 *(nova)* | P2-02 (`authVersion`); **escolha de provedor de e-mail — decisão humana em aberto** | **dura**, e a segunda é bloqueadora até resolvida |
| P3-00A *(nova)* | — | independente, *Should have* |
| P3-00B *(nova)* | — | independente, *Should have*, recomendada antes/junto de P2-02 |
| P3-01 | ~~P0-01 (retenção)~~ ✅ satisfeita (D2: 60 dias); **P0-02 recomendada antes** | preferencial |
| P3-02 | P3-01 (`correlationId`) | **dura** |
| P3-03 | P3-01, P3-02 | **dura** |
| **P3-04** | **P3-01 e P4-02** | **dura** |
| P4-01 | ~~P0-01 (valor de `N`)~~ ✅ satisfeita (D1: 100) | **dura** — destravada |
| P4-02 | ~~P0-01~~ ✅, P4-01 — **não depende mais de P3-01** *(r2)*. Valores do modo B seguem `DEFERRED_WITH_GATE` (D4) | **dura** |
| P4-03 | ~~P0-01 (política)~~ ✅ satisfeita | **dura** |
| P5-01 | ~~P0-01~~ ✅ (plataforma) | **dura** |
| P5-02 | P5-01, P2-01 | **dura** |
| P5-03 | P5-01 | **dura** |
| P5-04 | P5-01, **P1-01, P1-02** | **dura** |
| P5-05 | P1, P3-03, **P3-04**, P4-02, P5-03, P5-04, **P0-02**, P2-02 | **dura** |
| P5-06 | — | independente |
| P6-01 | todas as P0 acima, **inclusive P0-02, P2-02 e P2-03** | **dura** |
| P6-02 | P6-01, **P3-04** | **dura** |
| P6-03 | P6-02 | **dura** |

**Ordens que não podem ser invertidas:**

| Restrição | Motivo |
|---|---|
| **P0-01 antes de P5-01** | A plataforma determina Dockerfile-ou-buildpack, hops de proxy, sink de log e backup. Implementar antes é retrabalho garantido. |
| **P0-02 antes de P6-01** | Nenhuma nota real de terceiro entra enquanto uma falha de IA puder criar produto no catálogo dele. É bloqueio de correção, não de conveniência. |
| **P0-02 antes de P3-01** *(preferencial, não dura)* | P3 instrumenta o pipeline. Instrumentar antes de corrigir a semântica gasta a janela do piloto medindo um comportamento que já sabemos errado — e obriga a reinterpretar o dado depois. |
| ~~P3-01 antes de P4-02~~ **removida em r2** | Era baseada na premissa errada de que o guard leria os eventos. O guard tem ledger próprio; as duas tarefas passam a ser **independentes** e paralelizáveis. |
| **P3-01 e P4-02 antes de P3-04** | Não há o que reconciliar sem as duas fontes. |
| **P4-01 antes de P4-02** | Sem teto de itens por nota, uma única requisição tem custo ilimitado e o orçamento tem uma cauda que ele não controla. |
| **P4-03 junto com P4-02** | Teto por usuário com cadastro aberto é contornável criando contas. |
| **P1 antes de P5-04** | O smoke test percorre as rotas de discovery. |
| **P1 antes de P6-01** | Sem discovery, o participante depende de SQL na segunda sessão — o piloto não é operável. |
| **P2-01 antes de P5-02** | O segredo de produção precisa ser gerado já sob a regra nova. |
| **P5-03 antes de P6-01** | Não se coloca dado real de terceiro num banco sem restore provado. |
| **P3 completo antes de P6-02** | Piloto sem telemetria persistida não produz o dado que é seu objetivo. |
| **P3-04 antes de P6-02** | Sem reconciliação, os números diários da janela não são confiáveis — e uma reserva vazada passa despercebida a janela inteira. |

**Paralelizáveis desde o dia 1** (nenhuma dependência): **P0-02, P1-01, P1-02, P2-01, P5-06** — e P0-01, que deve ser a primeira a começar por ser a que destrava mais coisas.

## 8. Caminho crítico

```
P0-01 (decisões) ─┬─► P5-01 (artefato) ─┬─► P5-02 (config verificada) ──────────────┐
                  │                     ├─► P5-03 (backup + restore ensaiado) ──────┤
                  │                     └─► P5-04 (smoke + rollback) ───────────────┤
                  │                              ▲                                  │
                  ├─► P3-01 (eventos, best-effort) ─► P3-02 ─► P3-03 ───────────────┤
                  │              └──────────────┐   │                               ├─► P5-05 ─► P6-01 ─► P6-02 ─► P6-03
                  ├─► P4-01 (teto de itens) ─► P4-02 (ledger, escrita forte) ───────┤
                  │                             └────────┴─► P3-04 (reconciliação) ─┤
                  └─► P4-03 (controle de cadastro) ─────────────────────────────────┤
                                                                                    │
P0-02 (unavailable ≠ no_match) ─────────────────────────────────────────────────────┤  ← bloqueia P6-01
                                                                                    │
P1-01 (GET /companies) ──┬──────────────────────────────► (P5-04) ──────────────────┤
P1-02 (GET /stocks) ─────┘                                                          │
                                                                                    │
P2-01 (entropia JWT) ──► (P5-02)                                                    │
        └─────────────► P2-02 (change password + authVersion) ──────────────────────┘  ← Must have (D3)
                              └───────────────► P2-03 (recuperação por e-mail) ─────────  ← Must have (D3), BLOQUEADA por provedor de e-mail

P5-06 (guarda de artefato) ── independente, a qualquer momento
P3-00A, P3-00B ── independentes, Should have, fora do caminho crítico — ver §14
```

**Nota de 2026-08-28:** este diagrama é anterior a D3 e mantido como referência visual do formato de dependências; P2-02 deixou de ser opcional e P2-03 é tarefa nova. **§14 é a fonte de verdade para a ordem atual**, não este diagrama.

**O caminho crítico mudou em r2, e a mudança é consequência direta da correção #2.**

Antes: `P0-01 → P3-01 → P4-02 → P6-01 → P6-02 → P6-03` — porque o guard de custo esperava a telemetria. Desfeita essa dependência, a cadeia P3→P4 se rompe em dois ramos curtos e paralelos, e a cadeia mais longa passa a ser a de infraestrutura:

**`P0-01 → P5-01 → P5-03 → P5-05 → P6-01 → P6-02 → P6-03`** — três tarefas **M** encadeadas (artefato de deploy → restore ensaiado → runbooks), contra as duas **M** do ramo de telemetria/custo, que agora correm em paralelo entre si.

Consequência prática: **P5-01 deve começar bem antes do que a r1 sugeria** (posição 12 na ordem original). Ver §14.

**P0-02 não está no caminho crítico** — é independente e **M** —, mas bloqueia P6-01 e é preferencialmente anterior a P3-01. Recomendo executá-la em segundo lugar mesmo assim: é a única correção de defeito do roadmap, e todo dia que ela não existe é um dia em que uma falha do Gemini pode sujar um catálogo.

**Trilhas paralelas sugeridas com duas pessoas:**
- **Trilha A (crítica, infraestrutura):** P0-01 → P5-01 → P5-02 → P5-04 → P5-03 → P5-05.
- **Trilha B (correção e produto):** P0-02 → P1-01 → P1-02 → P2-01 → P5-06 → P3-00B → P2-02 → P2-03 (bloqueada por provedor de e-mail, não trava o resto da trilha) → P4-01 → P4-02 → P4-03 → P3-01 → P3-00A → P3-02 → P3-03 → P3-04.

As duas convergem em P5-05 e, de lá, em P6-01.

## 9. Matriz de riscos

| Risco | Prob. | Impacto | Mitigação | Tarefa |
|---|---|---|---|---|
| **Custo Gemini descontrolado** — nenhum teto; itens por nota ilimitados; cadastro aberto; teto por usuário contornável | **Alta** | **Alto** — financeiro, sem limite superior | Teto global diário/mensal + por usuário, reserva atômica, fail-closed, kill switch por configuração; limite de itens por nota; controle de cadastro; cota no provedor como backstop | **P4-01, P4-02, P4-03** |
| **Telemetria não retida** — stdout sem sink; o piloto roda e não produz dado | **Alta** se nada for feito | **Alto** — anula o objetivo do piloto e mantém M5-02/M6-02 bloqueadas | Persistir eventos em Postgres com retenção definida e consultas versionadas | **P3-01, P3-02, P3-03** |
| **Correlação de custo falsificável** — `X-Request-Id` é aceito do cliente | Média | Médio — métricas por nota silenciosamente erradas | `correlationId` gerado no servidor como única chave de correlação | **P3-01** |
| **Vazamento entre tenants** nas rotas novas de discovery | Baixa | **Alto** — quebra do isolamento, prioridade 2 do CLAUDE.md | Predicado de autorização no repositório (não no controller), reusando `findByIdForViewer`; teste de isolamento no gate PostgreSQL | **P1-01, P1-02** |
| **`TRUST_PROXY_HOPS` errado** — rate limit contornável por XFF forjado, ou todos limitados juntos | **Alta** (é o default `0` atrás de proxy) | **Alto** — desativa a única defesa entre cadastro público e custo de IA | Valor exato da plataforma + **verificação empírica** dos dois cenários | **P5-02** |
| **Backup não restaurável** | Média | **Crítico** — perda total, irreversível | Restore ensaiado, cronometrado, com contagem de linhas e `migrate status`; repetido com dado real | **P5-03, P6-02** |
| **Falha de migration no deploy** — CLI ausente após prune; `prisma.config.ts` exige `GEMINI_API_KEY` | **Alta** na primeira tentativa | Médio — deploy travado, não perda de dado | Passo de migration próprio com CLI disponível; desacoplar a config; `migrate status` como critério; política expand/contract | **P5-01, P5-04** |
| **Conta travada permanentemente** — sem reset, sem admin | Média | Médio — participante perdido, dado inacessível | Script de operador com auditoria + runbook; `PATCH /me/password` como higiene | **P5-05**, P2-02 |
| **Indisponibilidade do Gemini** | Média | Baixo/Médio — upload falha, o resto opera | Já mitigado: timeout 30s, 2 tentativas, erro traduzido (502/503/504); runbook de diagnóstico por `failureCategory` | já implementado + **P5-05** |
| **DANFE inválida ou ilegível** | **Alta** (é o caso real) | Baixo — falha isolada | Já mitigado: schema zod, CNPJ, chave de 44 dígitos, coerência de totais; runbook de diagnóstico por `correlationId` | já implementado + **P5-05** |
| **Falha de similaridade vira produto novo silenciosamente** — `findSimilarProduct` captura o erro e devolve `null` (`gemini-ai.provider.ts:346-349`), fazendo o item ser cadastrado como produto novo em vez de virar sugestão | **Alta** — basta um timeout | **Alto** — corrompe o catálogo do cliente, silenciosa e irreversivelmente pelo usuário; viola a invariante de identidade de produto do `CLAUDE.md` | **Mitigado em r2.** Resultado de similaridade passa a distinguir `match` / `no_match` / `unavailable`; `unavailable` aborta a nota **antes** de qualquer persistência, sem consumir a chave de idempotência | **P0-02** (correção); **P3-01** (frequência); **P6-03** (decidir sobre `UNRESOLVED`) |
| **Nota legítima abortada por falha transitória do Gemini** — risco *introduzido* por P0-02 | Média | Baixo/Médio — o usuário reenvia e paga nova extração | Retry limitado já absorve a falha comum (2 tentativas, backoff); nada é persistido, então o reenvio é sempre possível; frequência medida em P6-02 e o estado `UNRESOLVED` reavaliado com dado | **P0-02**, **P6-02**, **P6-03** |
| **Guard de custo apoiado em escrita best-effort** — risco de projeto que a r1 continha | (evitado) | **Alto** — cada evento de telemetria perdido seria orçamento liberado em silêncio | **Corrigido em r2 antes de existir código.** Ledger próprio com escrita forte e fail-closed; nenhum caminho lê `ai_call_events` para autorizar gasto — é critério de aceite verificável em revisão | **P4-02** (critério 10), **P3-01** (critério 7) |
| **Ledger e eventos divergem sem ninguém notar** | **Alta** sem reconciliação | Médio — decisões do piloto tomadas sobre números que discordam entre si | Reconciliação periódica das três fontes (ledger, eventos, fatura) com faixa de tolerância declarada e classificação de anomalia; diária durante a janela | **P3-04** |
| **Revogação de token não determinística** — risco que a estratégia `iat` × `passwordChangedAt` da r1 introduziria: truncagem de segundo e dois relógios (app e banco) tornam a fronteira imprevisível | (evitado) | Médio — token que deveria morrer sobrevive, ou sessão válida é derrubada sem motivo | **Corrigido em r2:** `authVersion` inteiro comparado por igualdade. Sem unidade de tempo, sem relógio, sem fronteira. Teste de "mesmo segundo" é critério de aceite | **P2-02** |
| **Vazamento de segredo** | Baixa | **Alto** | `.env` ignorado; `redact` no logger; segredos só pelo painel do Render; varredura como critério de aceite; entropia mínima de `JWT_SECRET`; **`invitecode` em `SENSITIVE_KEYS`**; `validate-request.ts` não ecoa valor recebido | **P2-01, P4-03, P5-02** |
| **Billing habilitado no projeto Google** — único caminho para gasto pago | Baixa | **Alto** — viola diretamente a decisão de USD 0 | Chave de projeto **sem conta de faturamento**; dono e permissões registrados; **verificação de faturamento zero na reconciliação periódica** | **P4-02** (gate), **P3-04** |
| **Um participante esgota a cota gratuita da coorte** | **Alta** sem guard | **Alto** — indistinguível de queda para os demais | Teto **por usuário** no ledger; limite de itens por nota; convite fecha a criação de contas; degradê `429`/`503` distinto | **P4-01, P4-02, P4-03** |
| **Retry de `429` de cota diária queima mais cota** — `isTransientError` trata 429 como transitório (`gemini-ai.provider.ts:99`) | **Alta** quando a cota acaba | Médio — acelera o esgotamento no pior momento | Distinguir 429 de janela curta de 429 de cota; na dúvida, **não repetir 429** | **P4-02** (critério 11) |
| **Limites reais do Free Tier desconhecidos** — não publicados na documentação, relatos divergentes | Média | Médio — tetos internos calibrados no escuro | **Gate operacional**: ler no AI Studio do projeto e registrar antes de configurar; tetos internos deliberadamente conservadores | **P4-02** |
| **Cold start interpretado como indisponibilidade** — Render 15 min + Neon 5 min | **Alta** — é o comportamento normal, não uma falha | Baixo/Médio — escalonamento desnecessário; healthcheck marcando falso negativo | Timeout do healthcheck acima do cold start medido; warm-up no smoke test; runbook 10; comunicar à coorte | **P5-02, P5-04, P5-05** |
| **`SIGTERM` empatado com o prazo do Render** — ambos 30 s | Média | Baixo/Médio — exit 1 espúrio, drenagem cortada, diagnóstico enganoso | `SHUTDOWN_TIMEOUT_MS` estritamente menor que o prazo da plataforma; `SIGTERM` real verificado com exit 0 | **P5-02** |
| **Janela de restore de 6 h insuficiente** — incidente detectado no dia seguinte fica fora | Média | **Alto** — perda de dado dentro de um sistema que "tem backup" | `pg_dump` diário do operador, **ambos os caminhos de restore ensaiados e cronometrados** | **P5-03** |
| **Scripts de operador sem ambiente de execução** — Render Free não tem shell nem one-off jobs | **Alta** — é uma limitação da plataforma, não um acaso | Médio — recuperação, purga e reconciliação sem onde rodar | Execução local contra o Neon, documentada em cada runbook; acesso direto ao banco de produção pelo operador registrado como custo aceito | **P5-05** |
| **Rate limit em memória zerado a cada spin-down** | Média | Baixo — janelas reiniciam após ociosidade | Aceito: o spin-down só ocorre sem tráfego, e tráfego mantém o serviço acordado; o convite fecha o vetor de cadastro; revisitar se houver múltiplas instâncias | aceito e registrado |
| **Estouro dos limites do plano gratuito** — 750 h/mês no Render, 0,5 GB no Neon | Baixa no volume do piloto | Médio — suspensão do serviço ou escritas recusadas | Instância única; spin-down preservado (não manter serviço acordado artificialmente); retenção de telemetria; volume observado na janela | **P3-03, P6-02** |
| **Exaustão do banco** — pool de 10; `/health` público sem limite tocando o banco | Média | Médio — indisponibilidade sob flood não autenticado | Rate limit/cache no `/health`; pool dimensionado com a plataforma | **P5-02** |
| **Ponto cego de observabilidade** — sem telemetria, um defeito só aparece se um participante reclamar | Alta se P3 não entrar | Médio | P3 completo + revisão diária durante a janela | **P3, P6-02** |
| **Reserva de orçamento vazando** — reserva não liberada em erro trava o teto abaixo do real | Média | Médio — nega serviço legítimo | Liberação em `finally`; teste explícito de liberação em erro; reserva expira com a virada do período; **detectada pela reconciliação**, que trata `reserved` residual como anomalia independentemente de valor | **P4-02**, **P3-04** |
| **Telemetria "esperando o pipeline certo"** — instrumentar antes de P0-02 mede um comportamento que já sabemos incorreto | Média | Baixo/Médio — desperdiça a janela do piloto e obriga a reinterpretar dado | Ordem preferencial P0-02 → P3-01, registrada em §7 e refletida em §14 | **P0-02**, **P3-01** |

## 10. Features deliberadamente adiadas

Regra que atravessa toda esta seção, e que nenhuma tarefa futura pode violar: **`Product.quantity`, `Product.unitPrice` e `Product.totalPrice` nunca são expostos em CRUD genérico.** Saldo é resultado de operação de domínio (entrada por nota, confirmação de sugestão), nunca campo editável. Uma rota que aceite `PATCH /products/:id { quantity }` destrói a rastreabilidade que o pipeline inteiro existe para garantir.

| Feature | Por que foi adiada | Gatilho de entrada | Dependência de domínio |
|---|---|---|---|
| **Estado `UNRESOLVED` de item de nota** *(novo em r2)* | P0-02 escolhe a resposta conservadora mínima — abortar a nota, sem persistir nada. `UNRESOLVED` exigiria novo status, migration, máquina de estados e endpoints de listar/resolver, **e** aceitaria persistir uma nota com efeito parcial no estoque e chave de idempotência consumida: um estado pior de desfazer se o caminho de resolução falhar | Frequência de notas abortadas por `unavailable` medida em P6-02 mostrar que o reprocessamento integral custa caro ou irrita a coorte. **Decisão declarada em P6-03** | Definir o que "nota parcialmente processada" significa para o saldo, e como ela aparece na auditoria |
| **Revogação administrativa via endpoint** *(novo em r2)* | O mecanismo passa a existir com `authVersion` (P2-02), mas a superfície fica no script de operador de P5-05. Um endpoint exigiria papel de administrador, que não existe no modelo | Necessidade recorrente que o script não atenda, ou coorte grande o bastante para o operador não dar conta | Definir quem pode revogar e como isso é autorizado |
| **Gestão de colaboradores** (`POST /companies/:id/collaborators`) | Nenhum colaborador pode existir hoje; construir a gestão antes do primeiro usuário multi-pessoa é feature sem usuário | Um participante do piloto pedir acesso para um segundo operador | Nenhuma — o modelo já suporta |
| **API de escrita de `StockPermission`** | Idem; sem colaboradores, permissões não têm sujeito | Junto com gestão de colaboradores | Definir quem concede permissão (só owner?) e se há papéis nomeados |
| **`POST /stocks`** | Toda empresa nasce com `Estoque Principal`; ninguém pediu um segundo | Um participante precisar separar estoques (filial, depósito) | Definir o que a separação significa: transferência entre estoques passa a ser exigida |
| **Multi-estoque de verdade** | Consequência do anterior | Idem | Exige transferência, e transferência exige o desenho de saída |
| **Saída / baixa de estoque** | **Não há desenho de domínio.** Baixa exige decidir custeio na saída, saldo negativo permitido ou não, e trilha de auditoria própria. Implementar sem esse desenho corrompe o custo médio ponderado que M3-01 estabeleceu | Necessidade real de acompanhar consumo, não só entrada | **Alta** — decisão de negócio sobre custeio e saldo negativo |
| **Transferência entre estoques** | Depende de saída e de multi-estoque | Depois dos dois | Atomicidade entre dois estoques; custo transferido ou recalculado |
| **Ajuste de inventário** | É uma escrita direta em saldo sob outro nome. Sem motivo obrigatório e auditoria dedicada, vira a porta dos fundos do CRUD proibido | Divergência real entre sistema e contagem física | Definir motivo obrigatório, aprovação e representação em `AuditLog` |
| **Histórico de movimentação** | `AuditLog` já registra `previousState`/`newState` de cada operação de produto. Uma view de histórico é apresentação, não dado novo | Um participante pedir "como este saldo chegou aqui" | Nenhuma — o dado existe; falta consulta |
| **Endpoint HTTP de `AuditLog`** | Decisão já registrada no README. Auditoria é dado sensível e não há política de autorização de leitura definida (quem lê o quê: owner da empresa? só o próprio usuário? admin inexistente?) | Requisito de compliance, ou necessidade recorrente do operador que o runbook não atenda | **Alta** — exige a política de autorização antes de qualquer rota |
| ~~Reset de senha por e-mail~~ *(promovida em 2026-08-28)* | **Deixou de ser adiada.** D3 (`docs/pilot-decisions.md`) tornou recuperação por e-mail requisito **antes** do piloto — ver **P2-03**. Linha mantida riscada para rastreabilidade da mudança de decisão; não é mais uma feature deferida. | — (já destravada por decisão humana) | Provedor de e-mail — **ainda não escolhido**; é o único bloqueio real de P2-03 |
| **Logout / refresh token / session store** | JWT de 1 dia + revogação via `authVersion` (P2-02) cobre o caso de comprometimento. Refresh existe para encurtar o token de acesso — sem uso em browser público, não paga a complexidade. Um session store trocaria um inteiro comparado no lookup que já existe por um subsistema inteiro | Sessões longas em browser, exigência de expiração curta, ou necessidade de revogar **uma** sessão em vez de todas | Decidir armazenamento do refresh e política de rotação |
| **Exclusão de conta** | Nenhum participante pediu; `onDelete: Cascade` em `Company` significa que apagar um usuário apaga empresa, estoque e produtos — consequência séria que exige decisão de negócio e de retenção fiscal | Exigência legal (LGPD) ou pedido real | **Alta** — conflito direto entre direito à exclusão e retenção de dado fiscal. Precisa de posição jurídica. |
| **Edição de metadados de produto** (`description`, `ean`, `ncm`) | Parcialmente uma decisão já tomada: M3-07 estabeleceu que o upsert **não** sobrescreve `description`. Uma rota de edição precisa respeitar isso e nunca tocar saldo/custo | Descrição extraída errada pela IA e o usuário precisar corrigir — provável, e P6 dirá | Escopo restrito a metadados; `quantity`/`unitPrice`/`totalPrice` **fora**, sempre |

## 11. Definition of Done do Pilot Readiness

O roadmap está concluído quando **todas** as linhas abaixo forem verdadeiras e verificadas.

**Portão local e de CI** (o DoD do `CLAUDE.md`, preservado integralmente)

- [ ] `npm ci` em checkout limpo
- [ ] `npm run prisma:generate`
- [ ] `npm run prisma:validate`
- [ ] `npm run typecheck`
- [ ] `npm run lint` — 0 problemas
- [ ] `npm test` — suíte verde
- [ ] `npm run test:integration:postgres:docker` — PostgreSQL Gate verde
- [ ] `npm run build`
- [ ] `npm run verify:production`
- [ ] CI Linux verde nos dois jobs
- [x] **Artefato compilado consistente com o fonte** (P5-06)
- [ ] Documentação sincronizada: README com as rotas novas, `.env.example` com as variáveis novas, backlog anterior intocado

**Portão de ambiente** *(concretizado para Render + Neon em r3)*

- [ ] Deploy acessível no **Render**, respondendo `/health` 200 contra o **Neon**
- [ ] `prisma migrate deploy` no build command; `prisma migrate status` limpo em produção
- [ ] `DATABASE_URL` usando a string *pooled* do Neon com `sslmode=require`
- [ ] Smoke test de deploy verde, **sem consumir cota de IA** e tolerando cold start
- [ ] `SIGTERM` → drenagem → **exit 0** verificado no ambiente real, com `SHUTDOWN_TIMEOUT_MS` **abaixo** do prazo do Render
- [ ] Rollback executado ao menos uma vez, com o limite de dois deploys registrado
- [ ] **Política expand/contract registrada como obrigatória** (migration no build não é revertida)
- [ ] Janela de restore do Neon confirmada em horas; `pg_dump` complementar documentado e executado
- [ ] **Restore ensaiado pelos dois caminhos** (branch Neon e `pg_dump`), com RPO e RTO medidos para cada
- [ ] Segundo ensaio de restore, com dado real, concluído
- [ ] Nenhum segredo no repositório (varredura executada); todos no painel do Render
- [ ] `JWT_SECRET` de produção com entropia adequada
- [ ] **`CORS_ALLOWED_ORIGINS` vazia**, com a decisão registrada; cliente HTTP sem `Origin` opera
- [ ] **`TRUST_PROXY_HOPS` verificado empiricamente nos dois cenários** (IPs independentes; XFF forjado não escapa)
- [ ] Cold start medido e timeout do healthcheck ajustado acima dele
- [ ] Consumo dentro dos limites gratuitos observado (horas Render, storage Neon)

**Portão funcional**

- [x] `GET /companies` implementada e testada (unitário, controller, rota, PostgreSQL Gate)
- [x] `GET /companies/:id/stocks` implementada e testada (unitário, controller, rota, PostgreSQL Gate) — **discovery mínimo Company → Stock completo; falta apenas o deploy em produção (P5)**
- [ ] Ciclo completo navegável pela API, **sem SQL em nenhum passo**: login → empresa → estoque → produtos → upload → sugestões → confirmar/rejeitar

**Portão de correção do pipeline de IA** *(novo em r2)* — ✅ **satisfeito por P0-02 em 2026-08-15**

- [x] `findSimilarProduct` distingue `match` / `no_match` / `unavailable` **no tipo** — não existe caminho em que falha de provedor e ausência de match sejam indistinguíveis
- [x] Falha de provedor na similaridade **não cria produto e não cria sugestão**
- [x] Nota abortada por `unavailable` **não persiste nada** — nem `Product`, nem sugestão, nem `ProcessedInvoice`
- [x] **Reenvio da mesma nota após o aborto é aceito**, não 409 — a chave de idempotência não foi consumida
- [x] Id alucinado (fora da lista de candidatos) classificado como `unavailable`, sem criar produto
- [x] `no_match` legítimo continua criando produto novo — sem regressão do caminho feliz
- [x] README descreve o comportamento em falha de similaridade

**Portão de observabilidade e custo**

- [ ] Eventos de IA persistidos, com `correlationId` gerado no servidor
- [ ] **Ledger de orçamento é registro próprio, com escrita forte** — nenhum caminho de código lê `ai_call_events` para autorizar gasto
- [ ] **Falha de escrita no ledger recusa a chamada de IA (503)**, verificado com o ledger rejeitando
- [ ] **Falha de escrita de evento não afeta a operação de negócio**, verificado com a telemetria rejeitando
- [ ] As 8 consultas de referência rodam e devolvem resultado coerente
- [ ] **Custo estimado é apresentado como estimativa** (`estimatedCostUsdNanos`), nunca como valor cobrado; o faturado é declarado zero
- [ ] Retenção de telemetria definida e implementada, **sem apagar o ledger**
- [ ] **Reconciliação executada ao menos uma vez**, com tolerância declarada, classes de divergência distinguíveis e **conferência de faturamento zero**
- [ ] **Gate operacional do modo A cumprido:** limites reais lidos no AI Studio e registrados; dono da conta e permissões registrados
- [ ] **Modo B habilitável por configuração**, sem alteração de código, com teste cobrindo as duas configurações
- [ ] Tetos internos de cota ativos e **abaixo** dos limites reais lidos, com esgotamento testado (global, por usuário, ledger indisponível)
- [ ] **Os quatro estados A/B/C/D distinguíveis**, com `GEMINI_ENABLED` separado do teto
- [ ] `GEMINI_ENABLED=false` verificado: IA desligada, resto do sistema operante, alternável sem novo deploy
- [ ] **`429` de cota não dispara retry**
- [ ] Modelo corrente tem entrada em `MODEL_PRICING`, com teste que o garante
- [ ] Cadastro exige código de convite; código redigido em log; rate limits de `/users` e `/companies` ativos

**Portão operacional**

- [ ] Os **onze** runbooks escritos e cada um percorrido ao menos uma vez, **cada um declarando onde é executado**
- [ ] Script de recuperação de conta funcional, auditado e testado — **invalidando os tokens anteriores via `authVersion`** (permanece como caminho de operador, complementar ao autosserviço de P2-03)
- [ ] Canal de incidentes ativo

**Portão de autenticação** *(D3, 2026-08-28: deixa de ser condicional — P2-02 e P2-03 são Must have antes do piloto)*

- [ ] Revogação **determinística**: token e troca de senha no mesmo segundo produzem o resultado correto
- [ ] Token sem a claim `authVersion`, ou com a claim de tipo inválido, é rejeitado com 401
- [ ] Hash e incremento de `authVersion` gravados na mesma escrita
- [ ] **P2-03**: código de recuperação armazenado só como hash, nunca em texto puro; uso único; expiração curta; limite de tentativas; resposta idêntica para e-mail existente e inexistente
- [ ] **P2-03**: confirmação de recuperação bem-sucedida incrementa `authVersion`, invalidando tokens anteriores pelo mesmo mecanismo de P2-02

**Portão de piloto**

- [ ] **Gate P6-00 concluído com evidência registrada** — projeto e API key identificados, tier adequado confirmado, política de dados revisada, budget configurado, kill switch verificado, teste controlado executado. **Sem ele, nenhuma DANFE real de terceiro entra.**
- [ ] Coorte com acesso e ciclo real executado com DANFE real
- [ ] Janela concluída, incidentes registrados com causa e resolução
- [ ] Reinício sob uso exercitado
- [ ] Reconciliação executada diariamente durante a janela
- [ ] `docs/pilot-report.md` publicado, com decisão explícita sobre M5-02, M6-02 **e o destino do estado `UNRESOLVED`**

## 12. Estratégia para desbloquear M5-02 e M6-02

### Por que estão bloqueadas

Ambas dependem de dado de M4-04, e M4-04 entregou **instrumentação**, não **telemetria retida**. O bloqueio está corretamente diagnosticado no backlog anterior. Este roadmap ataca as duas metades: P3 dá retenção e consulta; P6 dá volume real.

### O que precisa existir (condições necessárias)

| Condição | Tarefa |
|---|---|
| Eventos de chamada de IA persistidos e consultáveis | P3-01 |
| Correlação por nota gerada no servidor | P3-01 |
| Confidence **bruta** persistida (bucket calculado na consulta) | P3-02 |
| Decisões de sugestão correlacionáveis | P3-02 |
| Consultas versionadas para as 8 perguntas | P3-03 |
| Volume real de uso | P6-02 |
| Interpretação e decisão registradas | P6-03 |

### Critérios objetivos de desbloqueio de M5-02

**Regra (objetiva, sem margem):** M5-02 só sai de bloqueada quando as quatro grandezas abaixo puderem ser computadas a partir de dado de **uso real** (nunca de CI ou teste):

1. distribuição de chamadas `product_similarity` por nota — p50, p95 e máximo, não só média;
2. custo médio e p95 por chamada `product_similarity`, e a **fração do custo total de IA** que ela representa;
3. latência p95 de `product_similarity` e sua contribuição para a latência do upload;
4. linha de base de qualidade: taxa de confirmação/rejeição das sugestões geradas pelo caminho atual.

**Regra de decisão, e ela tem três saídas:**

- **Fechar M5-02 como "não compensa"** se a similaridade representar **< 20% do custo total de IA** e sua contribuição na latência p95 for aceitável para o uso real. Neste caso, o batching troca uma qualidade validada por uma não validada em nome de um ganho marginal — exatamente o que a tarefa original manda evitar. **Fechar é um resultado legítimo e provavelmente o mais provável**, dado que a extração de imagem/PDF tende a dominar o consumo de tokens.
- **Implementar** se a similaridade for parcela material do custo **ou** da latência, com a linha de base de qualidade em mãos para comparação antes/depois.
- **Continuar bloqueada** se o volume não permitir computar as quatro grandezas.

**Sugestão (não é regra) de volume mínimo para uma primeira leitura:** ~30 notas reais, de ≥ 3 empresas distintas, produzindo ≥ 50 chamadas de similaridade. A justificativa é modesta e deve ser lida como tal: abaixo disso, o p95 de "chamadas por nota" é dominado por uma ou duas notas atípicas e a fração de custo tem variância grande demais para sustentar uma decisão. Não é um cálculo de poder estatístico e não deve ser apresentado como um.

### Critérios objetivos de desbloqueio das bandas de decisão de M6-02

**Restrição de domínio que limita o que "banda" pode significar.** O `CLAUDE.md` é explícito: toda decisão que altere identidade de produto é determinística ou exige confirmação humana. Portanto uma banda **jamais** pode autoconfirmar uma sugestão, por maior que seja a confiança. As únicas ações que uma banda pode habilitar são: **(a)** mover o limiar de *criação* de sugestão (abaixo dele o item vira produto novo, como já ocorre); **(b)** alterar ordenação ou apresentação das sugestões pendentes. Qualquer proposta além disso deve ser recusada na revisão.

**Regra:** só introduzir ou mover uma banda quando, para as faixas envolvidas, houver **≥ 20 decisões humanas por faixa** e a taxa de aceitação de faixas adjacentes diferir por margem que sobreviva a um teste simples de proporções. Com menos, a diferença observada é ruído.

**Sugestão:** os cinco buckets existentes provavelmente são granulares demais para o volume de um primeiro piloto. Uma leitura inicial em três faixas (`< 0.7` não gera sugestão, `0.70–0.84`, `≥ 0.85`) atinge o mínimo de decisões por faixa muito antes. Como P3-02 persiste a confidence **bruta**, essa escolha de faixa é feita na consulta e pode ser refeita quantas vezes for preciso — é precisamente por isso que persistir bruto importa.

**Se o critério não for atingido:** manter `0.7` e registrar em P6-03 que o limiar segue sem sustentação empírica. Isso é um resultado honesto, não uma falha do piloto.

## 13. Decisões que ainda exigem aprovação humana

**Atualização 2026-08-28: todas as dez decisões deste roadmap foram resolvidas ou formalmente classificadas.** Ver `docs/pilot-decisions.md` para o registro completo (D1–D7), com responsável, data e justificativa. Tabela abaixo preservada para rastreabilidade histórica.

#### Resolvidas em 2026-08-15

| # | Decisão original | Resultado |
|---|---|---|
| ~~1~~ | Plataforma e PostgreSQL gerenciado | **Render Free + Neon Free** |
| ~~2~~ | Existe frontend? | **Não durante o piloto** → `CORS_ALLOWED_ORIGINS` vazia |
| ~~3~~ | Política de `POST /users` | **Código de convite compartilhado** |
| ~~4~~ | Teto de custo Gemini em USD | **USD 0** → o guard muda de unidade, de USD para cota (P4-02) |

#### Resolvidas em 2026-08-28 — ver `docs/pilot-decisions.md`

| # | Decisão | Bloqueava | Resultado |
|---|---|---|---|
| ~~5~~ | **Máximo de itens por DANFE** | **P4-01** | **APPROVED — D1: 100 itens.** Reavaliar com evidência real de distribuição de itens por DANFE durante a janela. |
| ~~6~~ | **Coorte: quantos, quem, e a janela do piloto** | P6-01, P6-02 | **APPROVED — D5 (teto de 200, não meta) + D6 (janela de 4 semanas).** "Quem" (composição/seleção de participantes) fica a critério operacional de quem envia o convite — nenhum critério de aceite hoje escrito exige mais que isso. |
| ~~7~~ | **Retenção de `ai_call_events`, em dias** | P3-01, P3-03 | **APPROVED — D2: 60 dias.** Aplica-se só a `ai_call_events`; não ao `AuditLog` nem ao `ai_usage_ledger`. |
| ~~8~~ | **`PATCH /me/password` entra no piloto ou fica para depois?** | P2-02 | **APPROVED — D3: entra antes**, com escopo ampliado (recuperação por e-mail vira **P2-03**, nova tarefa, bloqueada só pela escolha — ainda não feita — de provedor de e-mail). |
| ~~9~~ | **Prazo legal de guarda de `AuditLog`** (pendência herdada de M5-01) | Nada neste roadmap | **DEFERRED_WITH_GATE — D7.** Política do piloto decidida (sem purga automática); o prazo definitivo vira gate de compliance explícito **antes da comercialização**, não bloqueador do piloto. Nenhum número foi inferido. |
| ~~10~~ | **Budget diário/mensal do Gemini quando o Paid Tier for ativado** *(r4)* | **P6-00**; não bloqueia a implementação de P4-02 | **DEFERRED_WITH_GATE — D4.** Free Tier é o modo aprovado do piloto (sem budget USD arbitrário — a cota do provedor é o limite externo). Paid Tier comercial permanece bloqueado até valores diário/mensal explícitos, calibrados com evidência real do piloto. |

*(A antiga decisão sobre uso de DANFE real sob os termos do free tier foi **resolvida em r4** — deixa de ser decisão aberta e passa a ser o gate operacional **P6-00**.)*

**Dois achados técnicos novos** surgiram da investigação read-only de `AuditLog` que fundamentou D7 — registrados como tarefas explícitas, não decisões humanas pendentes: **P3-00A** e **P3-00B** (ver seções dedicadas na Parte P3 abaixo).

**Nenhuma decisão artificial foi criada.** Itens que a análise de Render/Neon/Gemini poderia ter transformado em "decisão humana" e que resolvi tecnicamente, porque têm resposta correta: valor de `TRUST_PROXY_HOPS` (medido, não escolhido), Dockerfile ou não (o runtime nativo basta), onde a migration roda (o plano Free só permite o build command), onde os scripts rodam (só há um lugar possível), e a estratégia de backup complementar (a mínima gratuita que satisfaz o critério já escrito).

---

### §13-A · Incompatibilidade material — ✅ **RESOLVIDA em 2026-08-15 (r4)**

> **Resolução aprovada.** O Free Tier passa a ser o tier de **desenvolvimento privado e validação técnica**. O **Paid Tier / configuração aprovada é pré-requisito operacional antes da entrada de usuários externos com DANFEs reais**, verificado pelo gate bloqueante **P6-00**.
>
> Isto **resolve o problema na raiz** em vez de administrá-lo: sob os termos que permitem uso do conteúdo para melhoria de produto, só transita dado sintético. Nenhuma das quatro alternativas abaixo foi escolhida — a resolução é uma quinta, melhor que a que eu havia recomendado (alternativa 1), porque não sacrifica o realismo do piloto nem depende de consentimento sobre um termo desfavorável.
>
> **Preço aceito:** custo de IA deixa de ser zero quando o piloto real começar. O alvo de R$ 0 permanece para a infraestrutura fixa (Render Free + Neon Free); o Gemini vira custo variável sob budget guard (P4-02 modo B). **Decisão dependente ainda aberta:** os valores de budget (§13, nº 10).
>
> **O que fica registrado do problema original** — porque a evidência continua válida e sustenta o gate:

Registro no formato exigido, preservado para rastreabilidade.

**Incompatibilidade.** A decisão "Gemini Free Tier only" carrega um termo de uso que não é sobre custo nem sobre cota, e que colide com a natureza do dado do piloto.

**Evidência.** A tabela de preços da Gemini Developer API distingue os tiers em uma coluna além do preço: **"Content used to improve our products" — free tier: `Yes`; paid tier: `No`.** Verificado em 2026-08-15 em [ai.google.dev/gemini-api/docs/pricing](https://ai.google.dev/gemini-api/docs/pricing).

**Impacto.** O piloto envia ao Gemini **o documento fiscal inteiro** — `extractDanfeData` transmite o arquivo em base64 (`gemini-ai.provider.ts:200-211`). Uma DANFE contém CNPJ e razão social do emitente, chave de acesso, catálogo de produtos, quantidades e valores. E o conteúdo **não é do usuário do piloto**: é de **fornecedores dele**, terceiros que não participam do piloto e não consentiram com nada. O prompt de similaridade envia adicionalmente descrições do catálogo do participante (`gemini-ai.provider.ts:296-305`).

Note que isto **não é** uma falha do desenho atual: o roadmap já proíbe conteúdo de documento na telemetria (P3-01) e o CLAUDE.md já trata a IA como componente não confiável. A questão é anterior a tudo isso — é sobre **o que o provedor pode fazer com o que legitimamente lhe enviamos**, e nenhum controle nosso alcança esse ponto.

**Alternativas** — em ordem crescente de custo:

| # | Alternativa | Custo | Efeito |
|---|---|---|---|
| 1 | **Aceitar explicitamente**, restringindo o piloto a DANFEs de empresas dos próprios participantes, com consentimento informado por escrito de cada um sobre o termo do free tier | R$ 0 | Preserva a decisão aprovada. Restringe o material de teste, o que **reduz o realismo** do piloto — e realismo é o objetivo dele. |
| 2 | **Usar notas sintéticas ou anonimizadas** na maior parte da janela | R$ 0 | Elimina o problema e **enfraquece o dado**: matching e sugestões só são interessantes sobre catálogo e descrições reais. |
| 3 | **Tier pago apenas para `invoice_extraction`** (a chamada que carrega o documento), mantendo similaridade no free | baixo, mas **rompe `paid budget = USD 0`** | Resolve onde o dado sensível está. Exige reabrir a decisão de orçamento e habilitar billing — que é justamente o que o gate de P4-02 proíbe. |
| 4 | **Adiar o piloto** até haver posição jurídica | R$ 0 | Custo de calendário. |

**Resolução adotada — nenhuma das quatro acima.** A decisão aprovada corta o nó pela raiz: **migrar de tier antes de o dado real entrar**, em vez de escolher entre restringir o dado (1, 2), quebrar parcialmente a política de custo (3) ou esperar (4). É melhor que a minha recomendação de então — a alternativa 1 preservaria o USD 0 ao preço do realismo do piloto, que é justamente o que o piloto existe para obter. **Registro que minha recomendação foi superada por uma opção que eu não havia enumerado**, e que a fronteira "dado sintético × dado real" é um critério mais nítido que "consentimento sobre um termo desfavorável".

Consequências operacionais: o gate **P6-00** verifica a migração; **P4-02** ganha o modo B; a decisão de **valores de budget** fica aberta (§13 nº 10). **Não bloqueia P0-02, P1, P2, P3, P4 nem P5** — o desenvolvimento segue no Free Tier com dado sintético.

**A r2 não acrescentou nenhuma décima decisão, e isto foi deliberado.** Três candidatas foram consideradas e resolvidas tecnicamente:

| Candidata | Por que não virou decisão humana |
|---|---|
| **P0-02 aborta a nota inteira, e o reenvio paga nova extração — o negócio aceita esse custo?** | É a candidata mais legítima, e resolvi pela ordem de prioridades do `CLAUDE.md`: **correção (1) precede confiabilidade (4) e performance (7)**. A alternativa que evita o custo — persistir a nota com efeito parcial — troca um custo de reprocessamento por um estado inconsistente no estoque, o que é regressão na prioridade 3 (integridade). Não há leitura da ordem de prioridades em que a escolha oposta ganhe. O que *é* decisão de negócio — **manter ou não** esse comportamento depois de conhecer a frequência real — está agendado em P6-03. |
| **Faixa de tolerância da reconciliação (5%)** | Parâmetro operacional sem consequência de negócio: começa em 5%, recalibra em P6-02 com dado. |
| **Invalidar todos os tokens vigentes ao aplicar `authVersion`** | Não há tokens reais a invalidar — o sistema é pré-lançamento. A alternativa (tratar claim ausente como válida) embutiria um bypass permanente no verificador. |

## 14. Ordem recomendada de execução

Ordem para **uma pessoa**, otimizada para reduzir risco cedo e evitar retrabalho. **Revista em r2:** P5-01 sobe da posição 12 para a 8, porque a cadeia de infraestrutura passou a ser o caminho crítico (§8). **Revista em 2026-08-28 (fechamento de P0-01):** P2-02 sai da posição condicional de fim de lista e sobe para logo após P2-01/P5-06 (D3 tornou-a Must have); P2-03 entra como nova tarefa, na mesma vizinhança, mas **bloqueada** por decisão humana ainda em aberto (escolha de provedor de e-mail); P3-00B entra antes de P2-02 por recomendação própria (mesma superfície de risco — novo call site de `AuditLog` tocando credenciais); P3-00A entra junto de P3-02 (mesmo tema — decisões de sugestão).

| # | Tarefa | Por que aqui |
|---|---|---|
| 1 | **P0-01** ✅ | **Concluída em 2026-08-28.** Todas as decisões (D1–D7) registradas em `docs/pilot-decisions.md`; duas com componente `DEFERRED_WITH_GATE` (D4, D7), sem bloquear nenhuma tarefa do piloto — ver relatório de fechamento. |
| 2 | **P0-02** ✅ | **Única correção de defeito do roadmap.** Cada dia sem ela é um dia em que uma falha do Gemini pode sujar um catálogo. Também precede P3, para que a telemetria meça o pipeline correto. Concluída, commitada (`cfa6ca3`). |
| 3 | **P1-01** ✅ | Bloqueador de piloto, sem dependência, e valida o padrão de rota nova. Concluída, commitada (`d02236e`). |
| 4 | **P1-02** ✅ | Fecha o gargalo do `stockId` e completa o ciclo pela API. Concluída, commitada (`de36707`). |
| 5 | **P2-01** ✅ | S, segurança, sem dependência; precisa preceder a geração do segredo de produção. Concluída, commitada (`a1b2c0c`). |
| 6 | **P5-06** ✅ | S, independente; garante que tudo daqui em diante é verificável. Concluída, commitada (`980624e`). |
| 7 | **P3-00B** ✅ | Executada antes de P2-02, como recomendado: as duas tarefas seguintes abrem exatamente o call site de `AuditLog` que ela protege (credenciais). Concluída, pendente de commit desta rodada. Suíte 336 → 388; Gate 37/37. |
| 8 | **P2-02** ✅ | Concluída e commitada. `authVersion` incrementado atomicamente na troca de senha; revogação determinística provada sem depender de avanço de relógio. Suíte 388 → 408; Gate 37 → 39. |
| 9 | **P2-03** | **SKIPPED_BLOCKED — decisão humana ainda em aberto.** Depende de escolha de provedor de e-mail (não coberta por D1–D7). Não implementar até a escolha chegar; o restante da ordem **não espera** por ela — prossiga para P4-01 em paralelo e volte a P2-03 assim que a decisão chegar, antes de P6-01. |
| 10 | **P4-01** ✅ | Concluída e commitada. `DANFE_MAX_ITEMS=100` (D1), fonte única no prompt e no schema; excesso vira 422 antes de qualquer chamada de similaridade. Suíte 408 → 418; Gate 39/39 (sem regressão). |
| 11 | **P5-01** ⏸ **HUMAN_DECISION_REQUIRED** | **Parcialmente preparada em 2026-08-28** (código/config prontos: `prisma.config.ts` desacoplado, comandos documentados, política expand/contract registrada). **O restante exige conta Render + Neon real** — provisionamento e credenciais, não decisão técnica. Início do caminho crítico: P5-02, P5-03, P5-04 e P6-01 dependem da mesma conta. |
| 12 | **P5-02** | Exige o ambiente de P5-01; consome o `JWT_SECRET` sob a regra de P2-01 |
| 13 | **P5-04** | Exige ambiente e as rotas de P1; a partir daqui todo deploy é verificado |
| 14 | **P5-03** | Exige o banco de produção; segunda **M** do caminho crítico |
| 15 | **P4-02** ✅ | Concluída e commitada. Modo A completo (D8: 18 req/dia global, 5/dia/usuário, tokens deliberadamente sem teto). `ai_usage_ledger` novo, reserva atômica real, fail-closed, kill switch, `429` deixa de repetir. Suíte 445 → 471; Gate 51 → 56 (concorrência real provada). |
| 16 | **P4-03** ✅ | Concluída, pendente de commit desta rodada. Fecha o contorno do teto por usuário. Suíte 422 → 432; Gate 39/39 (sem regressão). |
| 17 | **P3-01** ✅ | Concluída e commitada. `ai_call_events` + `correlationId` gerado no servidor, propagado a extração/similaridade/persistência. `PrismaAiTelemetry` best-effort, log estruturado preservado sem `userId`/`companyId`/`stockId`. Suíte 432 → 441; Gate 39 → 41 (sem regressão). |
| 18 | **P3-00A** ✅ | Concluída e commitada. `confirm`/`reject` de sugestão passam a auditar a alteração real de produto (`productSuggestionDecided`, builder novo). Sem migration. Suíte 441 → 445; Gate 41/41 (sem regressão). |
| 19 | **P3-02** ✅ | Concluída e commitada. Como **view** (`ai_suggestion_events`), não tabela — critério de aceite 1 exigia essa avaliação, e ela decidiu contra a tabela. Suíte 445/445 (inalterada); Gate 41 → 42. |
| 20 | **P3-03** ✅ | Concluída e commitada. `docs/telemetry-runbook.md` (8 consultas) + retenção via `scripts/purge-ai-call-events.mjs` (D2: 60 dias, script de operador, sem scheduler). Suíte 445/445 (inalterada); Gate 42 → 51. |
| 21 | **P3-04** ✅ | Concluída e commitada. `scripts/reconcile-ai-usage.mjs`, somente leitura, `SUM(attempts)` (não `COUNT`) contra `spentRequests` — achado do Design Review evitou comparar grandezas diferentes. Suíte 471/471 (inalterada); Gate 56 → 69. |
| 22 | **P5-05** ⏸ **SKIPPED_BLOCKED** | P3-04 e P4-02 concluídas — não são mais o que bloqueia esta tarefa. Ainda bloqueada por depender de P5-03/P5-04, que exigem a conta Render+Neon de P5-01 (bloqueada). Nenhum código escrito. |
| 23 | **P6-01** ⏸ **SKIPPED_BLOCKED** | Portão de entrada do piloto. **Exige P2-02 e P2-03 concluídas** (Must have, D3) — P2-03 segue bloqueada pela escolha de provedor de e-mail, ainda não feita. Coorte até 200 (D5, teto não meta). |
| 24 | **P6-02** ⏸ **SKIPPED_BLOCKED** | Depende de P6-01 (bloqueada acima). A janela — **4 semanas** (D6, valor concreto, substitui a faixa 2–4). |
| 25 | **P6-03** ⏸ **SKIPPED_BLOCKED** | Depende de P6-02 (bloqueada acima). A conversão em decisão. |

**Com duas pessoas**, use as duas trilhas de §8: a trilha A (infraestrutura, crítica) e a trilha B (correção e produto) são quase inteiramente independentes e só convergem em P5-05. P3-00A/P3-00B/P2-03 podem correr em qualquer trilha sem afetar o caminho crítico de infraestrutura, desde que P2-03 não seja tratada como bloqueadora de P4-01/P5-01 — só bloqueia P6-01.

**Ajuste da r3 à ordem:** com Render e Neon decididos, **P5-01 pode começar imediatamente após P0-01** — não há mais espera por decisão. Duas tarefas ficaram mais baratas do que a r2 supunha (P5-01 perde o Dockerfile e ganha o CLI do Prisma de graça no build; P4-03 tem a política definida), e uma ficou mais cara (P5-03 ganha o caminho de `pg_dump`). O saldo é neutro e as estimativas de §15 não mudam.

**Único bloqueador humano remanescente que impede o caminho crítico de chegar até P6-01 sem interrupção: a escolha de provedor de e-mail para P2-03.** Nenhuma outra tarefa da lista acima espera por decisão humana — é a única lacuna que sobrevive ao fechamento de P0-01.

## 15. Estimativa agregada

| Milestone | Tarefas | S / M / L | Estimativa |
|---|---|---|---|
| P0 — Portão pré-piloto | **2** | 1 / **1** / 0 | **1,5–3,5 dias** |
| P1 — Discovery API | 2 | 2 / 0 / 0 | 1–2 dias |
| P2 — Autenticação | 2 | 1 / 1 / 0 | 2–4 dias |
| P3 — Telemetria | **4** | **3** / 1 / 0 | **4–6 dias** |
| P4 — Custo e abuso | 3 | 2 / 1 / 0 | 3–5 dias |
| P5 — Deployment | 6 | 3 / 3 / 0 | 6–9 dias |
| **Subtotal técnico (P0–P5)** | **19** | **12 / 7 / 0** | **17,5–29,5 dias úteis** |
| P6 — Piloto | 3 | 2 / 0 / 1 | 1,5 dia de trabalho + **4 semanas de janela** (D6) |
| **Total** | **22** | | **~19–30 dias úteis + janela de calendário** |

**Delta da r2:** +2 tarefas (**P0-02** M, **P3-04** S) e +2 a +4 dias úteis. A r1 estimava 20 tarefas e 17–26 dias.

**Nota de 2026-08-28 (fechamento de P0-01):** a tabela acima **não foi recalculada** nesta rodada — é puramente decisão/governança, sem implementação. Três tarefas novas entraram no roadmap e não estão contadas acima: **P2-02** deixou de ser *Should have* e passou a **Must have antes do piloto** (D3), **P2-03** (recuperação de senha por e-mail, nova, M estimado mas não confirmado — bloqueada pela escolha de provedor de e-mail, decisão humana ainda em aberto), **P3-00A** e **P3-00B** (S cada, ambas *Should have*, não bloqueadoras do piloto — ver seções dedicadas). O total deixa de ser 22 e passa a **25**, sem que isso represente dias adicionais no caminho crítico até o piloto: P3-00A/P3-00B são pós-piloto/paralelas por classificação própria, e P2-03 só entra em estimativa quando o provedor de e-mail for escolhido.

Com uma pessoa: **5–7 semanas** até o piloto começar, mais a janela. Com duas em trilhas separadas: **4–5 semanas** até o início — a compressão melhorou um pouco em termos relativos, porque desfazer a dependência P3-01 → P4-02 tornou as trilhas mais independentes.

Nenhuma tarefa é **L** em esforço — P6-02 é **L** em calendário, com carga diária baixa. Isso é deliberado: tarefas grandes escondem decisões, e o roadmap precisa ser executável por agente uma tarefa por vez, como o `CLAUDE.md` exige.

## 16. Autocrítica

Respondendo às oito perguntas exigidas, sem suavizar.

**Estamos construindo algo por simetria?**
Dois pontos de risco, ambos com salvaguarda embutida. **P3-02** (tabela de eventos de sugestão) é o candidato mais forte: `product_similarity_suggestions` já guarda `confidence`, `status`, `decidedAt`, `decidedByUserId` e `stockId`. Por isso a tarefa **exige** avaliar uma view antes de criar tabela, e registra a decisão. Se a view resolver, a tabela não deve nascer. **P1-02** poderia parecer simétrica a P1-01 ("se tem lista de empresas, tem lista de estoques"), mas não é: o `stockId` é o parâmetro obrigatório de três rotas e hoje é indescobrível. É necessidade, não simetria. Também recusei explicitamente `GET /me`, `GET /stocks/:id` e um endpoint de auditoria — os três teriam entrado por simetria.

**Estamos antecipando feature sem usuário?**
Uma decisão merece escrutínio: **P1-01 inclui colaborações no predicado embora nenhum colaborador possa existir**. Defendo porque é o mesmo `findMany` com um `OR` — custo zero de implementação e de execução — enquanto entregar só *owned* garante uma quebra de contrato depois. Mas registro: se a revisão discordar, restringir a `ownerId` é uma simplificação aceitável e nada mais no roadmap depende disso. Em contrapartida, adiei explicitamente gestão de colaboradores, `POST /stocks`, multi-estoque, saída, transferência, inventário, endpoint de auditoria, reset por e-mail, refresh token e exclusão de conta — dez features que caberiam num roadmap "completo" e que não têm usuário.

**Estamos adicionando infraestrutura maior que o MVP?**
Recusei OpenTelemetry, backend externo de métricas, dashboard, alertas, fila, cache, Redis, store distribuído de rate limit, segunda instância, blue/green e CD automático. A infraestrutura nova são **três tabelas no Postgres que já existe** — eventos, ledger e (talvez) eventos de sugestão, esta última só se a view de P3-02 não bastar. A r2 acrescentou uma tabela ao total, e vale examinar se foi ganho ou inchaço: o ledger não é uma segunda cópia dos eventos, é o registro que os eventos **não podem ser** — poucas linhas agregadas, escrita forte, contrato oposto. Fundi-las voltaria a produzir exatamente o defeito que a r2 corrigiu. A parte que mais se aproxima do excesso continua sendo a reserva atômica de P4-02 — um único statement SQL, com a alternativa mais simples (verificar-então-chamar) registrada e defensável se a implementação se mostrar mais cara que o descrito.

**O roadmap realmente leva ao primeiro uso real?**
Sim, e o teste é o portão funcional do DoD: o ciclo completo navegável **sem SQL em nenhum passo**. Percorri o caminho contra as rotas existentes e as duas propostas e ele fecha. P6-01 força a execução real com uma DANFE real antes de a coorte entrar — não é um checklist teórico.

**Há algum ponto onde o usuário ainda depende de SQL ou de intervenção manual?**
Depois de P1 e P5-05: **um**, deliberado. Recuperação de conta travada exige um operador rodando um script. Aceito conscientemente porque a alternativa (reset por e-mail) é um subsistema inteiro para uma coorte nominalmente conhecida, e a alternativa intermediária (endpoint de admin) exige um papel de administrador que não existe no modelo de dados. O gatilho para mudar está escrito em §10. Tudo o mais que hoje exige SQL — descobrir empresa, descobrir estoque, diagnosticar nota — passa a ter caminho pela API ou runbook.

**Existe algum estado irrecuperável?**
Três hoje; **a r2 fecha os três.** Perda de banco → P5-03 com restore ensaiado, repetido com dado real em P6-02. Conta travada → script de operador em P5-05.

O terceiro merece o registro completo, porque a r1 errou aqui e o erro é instrutivo. Um item cuja chamada de similaridade falha era cadastrado como produto novo, deixando duplicata no catálogo sem sinal ao usuário. **A r1 deixou isso aberto** com o argumento de que não sabíamos a frequência e que mudar comportamento sem dado é o erro que M5-02 evita. **O argumento estava mal aplicado.** A disciplina "não mude sem dado" existe para escolhas de *calibração* — limiar, tamanho de lote, faixa de decisão — onde o dado diz qual valor é melhor. Aqui não havia calibração: `provider_failure` não é evidência de `no_match` sob nenhuma frequência. O dado responderia "quanto custa o defeito", nunca "se é defeito". Invocar falta de dado para adiar uma correção de semântica foi transformar uma boa regra em desculpa — e, pior, planejava-se usar a janela do piloto, com notas reais de terceiros, para quantificar um bug já compreendido. P0-02 corrige. O que **permanece** dependente de dado é a escolha *entre duas respostas corretas* — abortar a nota (P0-02) ou o estado `UNRESOLVED` — e essa sim é calibração legítima, agendada em P6-03.

**Existe algum custo sem limite?**
Hoje sim, e é o pior achado da análise: ilimitado em três dimensões simultâneas (itens por nota, contas criáveis, ausência total de teto). P4-01, P4-02 e P4-03 fecham as três. **A r2 fechou um quarto vetor, mais sutil**: na r1, o teto lia a telemetria best-effort, então cada evento perdido liberava orçamento em silêncio — a proteção teria a confiabilidade do componente que o próprio projeto autoriza a falhar. O ledger com escrita forte fecha isso, e P3-04 verifica que continuou fechado. Fica um resíduo honesto e agora **mensurável**: chamadas que falham não reportam `usageMetadata`, então o gasto real é levemente **subestimado**; a magnitude é medida contra a fatura em P3-04 e vira margem do teto.

**Existe algum dado essencial sem retenção?**
Hoje toda a telemetria de IA — que é literalmente o objetivo do piloto. P3 resolve. Após o roadmap, o único dado sem retenção definida é `AuditLog`, e isso é intencional: a decisão conservadora de M5-01 (não apagar dado fiscal sem prazo legal definido) permanece intocada, e a purga de P3-03 é explicitamente proibida de tocá-la. A r2 acrescentou uma segunda exclusão à purga: o **ledger** também nunca é apagado — é agregado e minúsculo, e apagá-lo destruiria o histórico de autorização de gasto. A pendência jurídica está registrada em §13.

**Uma crítica que as oito perguntas não cobrem:** este roadmap tem **19 tarefas técnicas para duas rotas HTTP novas de funcionalidade de usuário**. A proporção é desconfortável e vale nomear. Ela se justifica porque o sistema não está incompleto em domínio — está incompleto em *operação*, e operação é quase toda infraestrutura, contenção e evidência. Se em algum momento a proporção parecer errada, a pergunta certa não é "por que tanta infra?", e sim "qual dessas 19 pode ser cortada sem criar um estado irrecuperável ou um custo sem limite?". Pela minha leitura, as candidatas honestas a corte continuam sendo **P2-02** (já classificada como *Should have*) e **P5-06** (higiene, não risco). **P0-02 e P3-04, acrescentadas em r2, não são candidatas**: a primeira é a única correção de defeito do conjunto, e a segunda é o que impede que a separação ledger/eventos vire duas verdades nunca confrontadas. As outras dezessete, não.

**Uma segunda crítica, sobre a própria revisão:** duas das três correções da r2 eram defeitos de projeto que eu havia escrito com confiança na r1 — o guard de custo sobre escrita best-effort, e a revogação por comparação de relógios. Nenhuma das duas teria falhado em teste unitário; ambas teriam falhado em produção, silenciosamente, meses depois. O padrão comum é ter tratado *dois contratos de confiabilidade diferentes* como se fossem o mesmo dado, e *tempo* como se fosse identidade. Vale carregar esses dois padrões como heurística de revisão para o resto da execução: **onde dois registros descrevem a mesma grandeza, verificar se têm o mesmo contrato de escrita; e onde algo é comparado por tempo, perguntar se poderia ser comparado por identidade.**

## 16-A. Validação da infraestrutura gratuita *(r3)*

Quinze perguntas de verificação, respondidas contra §5-A. Onde a resposta é "não sabemos", isso está dito.

| # | Pergunta | Resposta |
|---|---|---|
| 1 | **Render Free é tecnicamente suficiente?** | **Sim**, para o piloto descrito. Instância única, volume baixo, coorte tolerante a cold start. As três limitações que exigiram redesenho — pre-deploy pago, sem shell, spin-down — têm resposta neste documento. Não é arquitetura de produção comercial, e a decisão já diz isso. |
| 2 | **Neon Free é tecnicamente suficiente?** | **Sim, com um complemento.** Storage, conexões e branches sobram. **A janela de 6 h de restore não basta sozinha** e é coberta por `pg_dump` (P5-03). |
| 3 | **Quais limitações estamos aceitando conscientemente?** | Cold start de Render (15 min → ~1 min) e de Neon (5 min); 750 h/mês; 0,5 GB; restore de 6 h; sem shell; rollback só para dois deploys; rate limit em memória zerando no spin-down; cota Gemini compartilhada e de valor não publicado; **conteúdo do free tier usado para melhoria de produto (§13-A)**. |
| 4 | **Algum componente obrigatório passou a exigir pagamento?** | **Durante o desenvolvimento, não** — o único que quase exigiu foi a migration, e o build command resolve sem custo. **A partir do piloto real, sim, por decisão:** o Gemini migra para Paid Tier (§13-A). Infraestrutura fixa segue gratuita. |
| 5 | **Custo fixo de R$ 0 se mantém?** | **Sim, para a infraestrutura fixa** — Render Free + Neon Free + GitHub, indefinidamente. O Gemini passa a ser **custo variável** a partir do piloto real, sujeito a budget guard. Fixo ≠ variável, e a decisão distingue os dois deliberadamente. |
| 6 | **Dá para garantir tecnicamente que não haverá cobrança do Gemini?** | **Durante o desenvolvimento, sim** — a chave pertence a projeto **sem conta de faturamento**, garantia externa ao código que nenhuma linha cria nem anula. **A partir do Paid Tier, a pergunta muda**: não é mais "impedir cobrança", é "manter a cobrança dentro do orçamento", e aí o mecanismo é o ledger em modo B. |
| 7 | **Qual o mecanismo concreto que impede gasto pago?** | **Modo A:** ausência de conta de faturamento no projeto emissor de `GEMINI_API_KEY`, reforçada por registro de dono/permissões e conferência periódica de faturamento zero (P3-04). **Modo B:** tetos de custo diário e mensal no ledger, com reserva atômica e fail-closed — mais a cota do provedor como backstop. A transição entre os dois é o gate **P6-00**. |
| 8 | **O que acontece quando a cota gratuita acaba?** | O provedor devolve `429 RESOURCE_EXHAUSTED`. **Antes disso**, nossos tetos internos — deliberadamente mais baixos — recusam com `503`/`429` e `Retry-After`, com mensagem clara. Login, discovery, produtos e **confirm/reject de sugestões pendentes continuam funcionando**. No modo B, o mesmo degradê vale para o esgotamento de **orçamento**. |
| 9 | **O que impede um participante de consumir a cota inteira sozinho?** | Três camadas: teto **por usuário** no ledger (P4-02); **máximo de itens por DANFE** (P4-01), que limita o consumo de uma requisição; e o **código de convite** (P4-03), que impede contornar o teto por usuário criando contas. O rate limit de 5 uploads/min já existente é a quarta. |
| 10 | **Backup + restore continuam possíveis sem custo?** | **Sim.** PITR de 6 h e branches do Neon são gratuitos; `pg_dump` é gratuito; o restore de ensaio usa uma branch, dentro das 10 do plano. |
| 11 | **Render Free exige Dockerfile?** | **Não.** Runtime nativo Node com build e start commands. Dockerfile explicitamente descartado, com justificativa e gatilho de revisão em P5-01. |
| 12 | **Como as migrations rodam sem recurso pago?** | No **build command** (`npm ci && npm run render:build`, que roda `prisma generate && tsc && prisma migrate deploy`). O build instala devDependencies, então o CLI do Prisma está disponível — o que **resolve** o obstáculo levantado na r1. Consequência: expand/contract vira obrigatório. |
| 13 | **Como validar `TRUST_PROXY_HOPS` no Render?** | Começar em `1` e **verificar por observação**: (a) dois clientes de IPs distintos limitados independentemente; (b) `X-Forwarded-For` forjado não escapa do limite. O teste (b) é o que distingue "correto" de "alto demais", e nenhum dos erros emite mensagem. |
| 14 | **A ausência de frontend elimina ou adia requisitos?** | **Adia dois e elimina zero.** Adiados: configurar origem real em `CORS_ALLOWED_ORIGINS` e autenticação em navegador. **Não eliminados:** a Discovery API (P1) segue obrigatória — sem ela o operador do piloto depende de SQL, com ou sem UI —, o CORS permanece no projeto com allowlist vazia (configuração válida, não ausência) e `authVersion` (P2-02) segue sendo o mecanismo de revogação. Adicionar frontend depois é **uma variável de ambiente**, sem redesenho. |
| 15 | **O convite introduz segredo novo a tratar?** | **Sim, e em três lugares**, todos verificados: variável obrigatória validada no boot em `env.ts`; `invitecode` em `SENSITIVE_KEYS` do logger (`normalizeKey` cobre `inviteCode`/`invite_code`/`invite-code` com uma entrada só); e `.env.example` sem valor real. **Já resolvido pelo código atual:** `validate-request.ts:7` não ecoa o valor recebido no erro — se ecoasse, o código voltaria ao cliente e ao log. |

## 17. Confirmação de escopo desta rodada

**Estado por rodada:** r1–r3 foram documentais, tocando apenas `docs/pilot-readiness-roadmap.md`. **r4 implementou e commitou P0-02** (`cfa6ca3`). **r5 implementou e commitou P1-01** (`d02236e`). **r6 (esta rodada) implementou P1-02 — não commitada**, aguardando revisão do checkpoint.

- Tarefas com código aplicado até agora: **P0-02** (commitada), **P1-01** (commitada), **P1-02** (pendente de commit). **Discovery mínimo Company → Stock está completo** — nenhuma tarefa deste roadmap continua exigindo SQL manual para o ciclo `login → empresa → estoque`. Nenhuma outra tarefa foi iniciada.
- **P0-01 permanece parcialmente concluída** — as decisões humanas foram tomadas (r3/r4); falta registrar `docs/pilot-decisions.md` formalmente e resolver as decisões nº 5–10 de §13 (a nº 5, máximo de itens por DANFE, é a que bloqueia P4-01).
- Nenhum serviço foi provisionado: não há conta, projeto ou deploy criado no Render, no Neon ou no Google. As decisões estão registradas; a execução é P5.
- Nenhum valor foi inventado para decisão em aberto: máximo de itens por DANFE, coorte, janela, retenção, `PATCH /me/password` e o prazo de guarda do `AuditLog` seguem sem número. Os limites reais do Free Tier do Gemini **não foram estimados** — são gate operacional.
- `docs/backlog-engenharia.md`, `docs/auditoria-tecnica.md`, `docs/implementation-progress.md` **não foram modificados** — M5-02 e as bandas de M6-02 permanecem com o status que já tinham; este documento apenas descreve a estratégia para desbloqueá-las. `README.md` **foi atualizado** em P0-02, P1-01 e P1-02, para refletir comportamento HTTP real (convenção do projeto: código e documentação nunca divergem).
- **Nesta rodada (P1-02): nenhum commit e nenhum push foram feitos.** As alterações de P1-02 estão no working tree, aguardando revisão do checkpoint.

O estado do repositório é: `main` em `d02236e` (2 commits à frente de `origin/main`: `cfa6ca3` P0-02, `d02236e` P1-01), mais o working tree desta rodada com a implementação de P1-02 não commitada.
