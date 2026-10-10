# Runbook de Telemetria — DocScan (P3-03)

> **Demonstração de portfólio (2026-10-10):** `GEMINI_QUOTA_ENFORCEMENT_ENABLED=false` desliga os tetos, mas preserva reservas, consumo e reconciliação. O ledger acima de 18/5 é esperado neste modo. `provider_rate_limit` identifica HTTP 429 do Gemini; não implica cota diária esgotada nem horário de recuperação. Reservas são reconciliadas no período em que começaram. Eventos de chamadas concluídas após meia-noite podem pertencer ao dia seguinte e causar divergência de fronteira temporal na reconciliação por dia. Investigue os dois dias antes de concluir perda de eventos.

> Consultas de referência sobre a telemetria de IA persistida (P3-01, P3-02), retenção de
> `ai_call_events` (D2, `docs/pilot-decisions.md`) e como diagnosticar a ausência de dado.
> Todo comando aqui **existe de fato** no projeto — nada neste documento é aspiracional.

**Fontes de dado:**

- `ai_call_events` (P3-01) — uma linha por chamada real ao Gemini (`invoice_extraction`/`product_similarity`), best-effort, nunca autoridade de gasto. Colunas: `id`, `correlationId`, `requestId`, `operation`, `model`, `modelVersion`, `status`, `durationMs`, `attempts`, `inputTokens`, `outputTokens`, `totalTokens`, `estimatedCostUsdNanos`, `failureCategory`, `userId`, `companyId`, `stockId`, `createdAt`.
- `ai_suggestion_events` (P3-02) — **view**, não tabela, sobre `product_similarity_suggestions` + `processed_invoices` + `stocks`. Cada sugestão gera um evento `created`; se decidida, um segundo evento `confirmed`/`rejected`. Colunas: `suggestionId`, `correlationId`, `stockId`, `companyId`, `decision`, `confidence` (bruta, `Decimal(5,4)`), `decidedByUserId`, `eventAt`.
- `ai_usage_ledger` (P4-02) — registro **autoritativo**, escrita forte, decide se uma chamada pode acontecer. `(scope, scopeId, periodKind, period)` como chave (`scope` ∈ `global`/`user`; `periodKind` só usa `day` hoje); `reservedRequests`/`spentRequests`/`reservedTokens`/`spentTokens`/`reservedCostUsdNanos`/`spentCostUsdNanos`. **Nunca lido para gerar as 8 perguntas acima** — é comparado contra `ai_call_events` só na reconciliação (abaixo).

**O que NÃO existe na telemetria, por design (não é lacuna, é decisão registrada):**

- Conteúdo do documento (imagem/PDF), `accessKey`, descrição de produto ou qualquer prompt/resposta bruta do Gemini — nunca persistidos, nem em `ai_call_events` nem em log.
- Custo **faturado** — `estimatedCostUsdNanos` é sempre estimado; sob Free Tier (D4) o faturado é sempre zero. Nunca apresentar a estimativa como cobrança.
- Teto de tokens — `ai_usage_ledger` acumula `spentTokens`/`spentCostUsdNanos` sem impor limite (D8): ausência deliberada de dado empírico, nunca zero nem ilimitado por acidente.
- `confidenceBucket` persistido — a faixa é sempre calculada na consulta (ver perguntas 6 e 7), nunca na emissão.

---

## As 8 perguntas do piloto

### 1. Latência (avg/p50/p95) por operação

Inclui **todas** as tentativas, sucesso e falha — uma chamada que deu timeout também é latência real observada, não deve ser descartada da amostra.

```sql
SELECT
  operation,
  ROUND(AVG("durationMs")::numeric, 2) AS avg_ms,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY "durationMs")::numeric, 2) AS p50_ms,
  ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY "durationMs")::numeric, 2) AS p95_ms,
  COUNT(*) AS sample_size
FROM ai_call_events
GROUP BY operation
ORDER BY operation;
```

**Leitura esperada:** `p95_ms` bem acima de `avg_ms` sinaliza cauda longa (retries, throttling); comparar `product_similarity` contra `invoice_extraction` — o segundo tende a ser mais lento (documento maior).

### 2. Tokens por nota

```sql
SELECT
  "correlationId",
  SUM("totalTokens") AS total_tokens,
  COUNT(*) AS calls
FROM ai_call_events
WHERE "totalTokens" IS NOT NULL
GROUP BY "correlationId"
ORDER BY total_tokens DESC;
```

**Leitura esperada:** insumo direto do dimensionamento de tetos internos de P4-02 (uma vez que os limites reais do provedor estejam registrados). Notas com `total_tokens` muito acima da mediana são candidatas a investigar (nota grande, muitos itens sem match exato).

### 3. Custo estimado por nota

```sql
SELECT
  "correlationId",
  SUM("estimatedCostUsdNanos") AS estimated_cost_usd_nanos
FROM ai_call_events
WHERE "estimatedCostUsdNanos" IS NOT NULL
GROUP BY "correlationId"
ORDER BY estimated_cost_usd_nanos DESC;
```

**Leitura esperada:** estimado, nunca faturado (D4). Serve para responder "quanto este sistema custaria fora do Free Tier" e como insumo de custo relativo de M5-02 — nunca como valor cobrado real.

### 4. Custo por dia e acumulado do mês

```sql
SELECT
  date_trunc('day', "createdAt") AS day,
  SUM("estimatedCostUsdNanos") AS daily_cost_usd_nanos,
  SUM(SUM("estimatedCostUsdNanos")) OVER (
    PARTITION BY date_trunc('month', "createdAt")
    ORDER BY date_trunc('day', "createdAt")
  ) AS month_to_date_cost_usd_nanos
FROM ai_call_events
WHERE "estimatedCostUsdNanos" IS NOT NULL
GROUP BY date_trunc('day', "createdAt"), date_trunc('month', "createdAt")
ORDER BY day;
```

**Leitura esperada:** tendência diária e acumulado do mês, sempre rotulados como estimativa. É o dado que, ao final do piloto, entra no relatório de saída (P6-03) como "custo estimado que este sistema teria fora do Free Tier".

### 5. Taxa de falha por `failureCategory`

```sql
SELECT
  "failureCategory",
  COUNT(*) AS failures,
  ROUND(
    COUNT(*)::numeric / NULLIF((SELECT COUNT(*) FROM ai_call_events), 0),
    4
  ) AS share_of_all_calls
FROM ai_call_events
WHERE status = 'failure'
GROUP BY "failureCategory"
ORDER BY failures DESC;
```

**Leitura esperada:** `timeout`/`provider_error` dominando sugere instabilidade do provedor (ver seção de diagnóstico abaixo); `invalid_response` dominando sugere resposta fora do schema, possível mudança de comportamento do modelo.

### 6. Distribuição de confidence (sugestões criadas)

Conta cada sugestão **uma vez**, no momento em que foi criada — `decision = 'created'` evita contar de novo quem já foi decidido (que gera um segundo evento).

```sql
SELECT
  CASE
    WHEN confidence < 0.70 THEN '0.00-0.69'
    WHEN confidence < 0.85 THEN '0.70-0.84'
    WHEN confidence < 0.95 THEN '0.85-0.94'
    ELSE '0.95-1.00'
  END AS confidence_band,
  COUNT(*) AS events
FROM ai_suggestion_events
WHERE decision = 'created'
GROUP BY confidence_band
ORDER BY confidence_band;
```

**Leitura esperada:** concentração perto do limiar (`SIMILARITY_CONFIDENCE_THRESHOLD`, default 0.7) é insumo para as bandas de decisão de M6-02 — mas definir essas bandas está fora do escopo desta tarefa.

### 7. Taxa de aceitação/rejeição por faixa de confiança

```sql
SELECT
  CASE
    WHEN confidence < 0.70 THEN '0.00-0.69'
    WHEN confidence < 0.85 THEN '0.70-0.84'
    WHEN confidence < 0.95 THEN '0.85-0.94'
    ELSE '0.95-1.00'
  END AS confidence_band,
  COUNT(*) FILTER (WHERE decision = 'confirmed') AS confirmed,
  COUNT(*) FILTER (WHERE decision = 'rejected') AS rejected,
  ROUND(
    COUNT(*) FILTER (WHERE decision = 'confirmed')::numeric
    / NULLIF(COUNT(*) FILTER (WHERE decision IN ('confirmed', 'rejected')), 0),
    4
  ) AS acceptance_rate
FROM ai_suggestion_events
WHERE decision IN ('confirmed', 'rejected')
GROUP BY confidence_band
ORDER BY confidence_band;
```

**Leitura esperada:** faixas com `acceptance_rate` baixo mesmo em confidence alta indicam que o limiar atual aceita matches que humanos rejeitam — evidência real para revisar M6-02, nunca decidido aqui.

### 8. Chamadas `product_similarity` por nota (distribuição)

Distribuição, não só média — uma nota com 40 itens pode gerar até 40 chamadas de similaridade; a média sozinha esconde o pior caso.

```sql
WITH per_invoice AS (
  SELECT "correlationId", COUNT(*) AS similarity_calls
  FROM ai_call_events
  WHERE operation = 'product_similarity'
  GROUP BY "correlationId"
)
SELECT
  ROUND(AVG(similarity_calls)::numeric, 2) AS avg_calls,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY similarity_calls) AS p50_calls,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY similarity_calls) AS p95_calls,
  MAX(similarity_calls) AS max_calls,
  COUNT(*) AS invoices_with_similarity_calls
FROM per_invoice;
```

**Leitura esperada:** `max_calls`/`p95_calls` altos, com `DANFE_MAX_ITEMS=100` (D1), estabelecem o teto real de chamadas por nota — insumo direto para calibrar P4-02.

---

## Consultar eventos de uma nota específica (por `correlationId`)

O `correlationId` de uma nota é devolvido só dentro do banco — nunca em log, nunca na resposta HTTP. Para investigar uma nota específica, primeiro localizar o `correlationId` via `ProcessedInvoice` (por `accessKey`, já indexado como único):

```sql
SELECT "correlationId" FROM processed_invoices WHERE "accessKey" = '<accessKey da nota>';
```

Depois, todas as chamadas de IA daquela nota:

```sql
SELECT operation, status, "durationMs", attempts, "failureCategory", "createdAt"
FROM ai_call_events
WHERE "correlationId" = '<correlationId encontrado acima>'
ORDER BY "createdAt";
```

E as sugestões que essa nota gerou, na mesma correlação:

```sql
SELECT "suggestionId", decision, confidence, "decidedByUserId", "eventAt"
FROM ai_suggestion_events
WHERE "correlationId" = '<correlationId encontrado acima>'
ORDER BY "eventAt";
```

**Quando não houver nenhuma linha:** confirmar primeiro que a nota **foi de fato processada** (existe em `processed_invoices`) antes de suspeitar de perda de telemetria — `ai_call_events` é best-effort por contrato (P3-01): a ausência de uma linha não prova que a chamada não ocorreu, só que o registro dela pode ter falhado. Cruzar com o log estruturado (stdout, evento `ai_operation`) do período aproximado antes de concluir.

## Diagnosticar falhas e indisponibilidade (`unavailable`)

```sql
SELECT operation, "failureCategory", COUNT(*), MAX("createdAt") AS last_seen
FROM ai_call_events
WHERE status = 'failure'
GROUP BY operation, "failureCategory"
ORDER BY last_seen DESC;
```

Combinar com a pergunta 5 para taxa relativa. Uma nota abortada por `unavailable` (P0-02) nunca chega a `processed_invoices` nem a `ai_suggestion_events` — só aparece aqui, em `ai_call_events`, com `status = 'failure'`.

## Verificar idade e volume da tabela

```sql
SELECT COUNT(*) AS total_rows, MIN("createdAt") AS oldest, MAX("createdAt") AS newest
FROM ai_call_events;
```

Se `oldest` estiver a mais de 60 dias da data atual, a retenção (abaixo) está atrasada ou não foi executada.

---

## Retenção — 60 dias (D2)

**Escopo da decisão (D2, `docs/pilot-decisions.md`): somente `ai_call_events`.** Nunca `AuditLog` (D7 — sem purga automática durante o piloto) nem `ai_usage_ledger` (P4-02 — nunca apagado por nenhuma política de retenção). O script (`scripts/purge-ai-call-events.mjs`) toca apenas uma tabela, por construção — não recebe nome de tabela como parâmetro.

**Como executar:**

```bash
npm run retention:ai-call-events
```

Requer `DATABASE_URL` apontando para o banco real (mesma variável de ambiente já usada pelo resto da aplicação). **Não é um job automático nesta fase** — o Render Free não oferece shell/cron/one-off jobs (mesma restrição já registrada para os demais scripts de operador em §5-A do roadmap); executar manualmente, sob demanda do operador, no cadastro de rotina operacional do piloto.

**Como verificar que funcionou:** o script imprime a contagem de linhas removidas e a data de corte usada. Repetir a consulta de "idade e volume" acima e confirmar `oldest` dentro de 60 dias. Rodar o script duas vezes seguidas sem novo dado deve remover `0` linhas na segunda vez — é o comportamento esperado (idempotente), não um erro.

**Se `DATABASE_URL` não estiver configurada ou a conexão falhar:** o script falha alto (exceção não tratada, saída não-zero) — não há fallback silencioso que "finja" ter rodado a retenção.

---

## Reconciliação ledger × eventos (P3-04)

**Duas fontes deliberadamente diferentes** (P4-02): `ai_usage_ledger` **autoriza** consumo (escrita forte, decide se o Gemini pode ser chamado); `ai_call_events` **observa** consumo (best-effort, nunca autoriza nada). Elas nunca são derivadas uma da outra em tempo de execução — só comparadas periodicamente, por este script.

**Grandeza comparável — não é a mais óbvia.** `ai_call_events` tem uma linha por **operação lógica** (`extractDanfeData`/`findSimilarProduct`); `ai_usage_ledger.spentRequests` debita uma unidade por **tentativa HTTP** (cada retry conta). Comparar `COUNT(ai_call_events)` com `spentRequests` divergiria por construção sempre que houvesse retry, sem ser perda nem anomalia. A comparação correta usa `SUM(ai_call_events.attempts)` — a própria coluna já registra quantas tentativas aquela operação fez.

**Como executar (somente leitura — nunca corrige nada):**

```bash
npm run reconcile:ai-usage              # reconcilia ontem (UTC) — período já fechado
npm run reconcile:ai-usage 2026-09-02   # reconcilia uma data específica
```

Sem argumento, o script usa **ontem** em UTC deliberadamente: reconciliar hoje reportaria `reservedRequests` de uploads genuinamente em andamento como se fosse reserva vazada — falso positivo por o período ainda estar aberto.

**Leitura do relatório, por bloco (`escopo:id — período`):**
- `requests: reconciliado.` — `SUM(attempts)` bate com `spentRequests`.
- `requests: dentro da tolerância (+1) — possivelmente tentativa recusada por cota no meio de um retry.` — **não é anomalia.** Uma tentativa que o guard recusou por cota, no meio de um retry, incrementa o contador de tentativas do evento antes de a reserva ser revertida — nunca chega a debitar o ledger. É o guard funcionando, não consumo perdido.
- `ATENÇÃO: eventos > ledger além da tolerância (+N)` — **investigar.** Localizar, por `correlationId` em `ai_call_events` (ver seção acima), quais operações do período têm `attempts` acima do esperado, e cruzar com o log estruturado (`ai_operation`) para descartar mais de uma rejeição de cota na mesma operação antes de tratar como consumo fora do guard.
- `ATENÇÃO: eventos < ledger além da tolerância` — possível perda best-effort persistente de `ai_call_events`; investigar volume de falha de escrita, não o ledger (que é a fonte confiável aqui).
- `ANOMALIA: reservedRequests=N residual num período fechado` — **sempre** investigar como falha entre reservar e reconciliar (P4-02), independentemente de requests/tokens baterem.

**Tolerância:** `max(1, 5% do valor do ledger)`, aplicada a requests/tokens/custo independentemente. O piso de 1 evita que, no volume do piloto (teto de 18 requisições/dia), qualquer perda isolada de telemetria vire falso positivo — recalibrar com dado real do piloto (P6-02), não antes.

**O que o script NUNCA faz:** corrigir o ledger a partir dos eventos (reintroduziria a dependência que a separação existe para evitar); apagar ou alterar qualquer linha de `ai_call_events`, `ai_usage_ledger` ou `AuditLog`; ler o painel de cota do AI Studio ou o faturamento do Google (não há API documentada).

**Procedimento manual, a cada execução (sem API para automatizar):** confirmar no console do Google que o **faturamento do projeto continua zero** (D4/D8) — é como se detecta que alguém habilitou billing sem passar pelo gate P6-00; e comparar a cota/uso real no **painel do AI Studio** contra `ai_usage_ledger.spentRequests` do período — divergência aqui calibra a margem do teto interno (18/dia global, 5/dia por usuário), nunca é lida automaticamente pelo script.
