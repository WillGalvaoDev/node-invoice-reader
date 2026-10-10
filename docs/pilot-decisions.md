# Decisões do Piloto — DocScan

> **Atualização de escopo — 2026-10-10.** Por decisão do responsável, o objetivo atual é uma demonstração de portfólio com IA real. A [especificação da demonstração](portfolio-demo-spec.md) e o [guia](portfolio-demo-guide.md) prevalecem para esta entrega: tetos diários internos desligados por padrão, consumo preservado, sem gate de lançamento comercial. As decisões, estados e restrições anteriores abaixo são histórico do piloto e referência para evolução futura. A ativação comercial exigirá reavaliação explícita.

> Documento de registro formal das decisões humanas que parametrizam o `docs/pilot-readiness-roadmap.md`.
> Fonte de verdade para qualquer tarefa marcada como dependente de "decisão humana" ou "P0-01".
> Nenhum valor aqui foi inferido ou adivinhado pelo agente — cada decisão foi tomada explicitamente pelo responsável humano do projeto, na data registrada.

**Convenção de status:**

- **APPROVED** — decisão tomada, valor concreto, destrava a(s) tarefa(s) associada(s) sem condição adicional.
- **DEFERRED_WITH_GATE** — decisão **deliberadamente** adiada até que uma condição objetiva (evidência, aprovação externa, escolha de terceiro) seja satisfeita. Não é "esquecida" nem "pendente por omissão" — é uma decisão de *quando* decidir, tomada agora. A tarefa correspondente permanece bloqueada **apenas** pela condição declarada, nunca por ausência de decisão.

Nunca use `DONE`/`APPROVED` para uma decisão que foi conscientemente adiada — isso apagaria a diferença entre "resolvido" e "resolvido decidir depois", que é exatamente a distinção que este documento existe para preservar.

---

## Tabela-resumo

| ID | Decisão | Status | Destrava | Bloqueia |
|---|---|---|---|---|
| [D1](#d1--máximo-de-itens-por-danfe) | Máximo de 100 itens/linhas por DANFE no piloto | **APPROVED** | P4-01 | — |
| [D2](#d2--retenção-de-ai_call_events) | Retenção de `ai_call_events`: 60 dias | **APPROVED** | P3-03 (parte de retenção) | — |
| [D3](#d3--password-management-pré-piloto) | Password management (troca + recuperação por e-mail) entra **antes** do piloto | **APPROVED** (escopo) / **DEFERRED_WITH_GATE** (provedor de e-mail) | P2-02 (reclassificada), nova P2-03 | P2-03 aguarda escolha de provedor de e-mail |
| [D4](#d4--gemini--budget-durante-o-piloto) | Free Tier no piloto, sem budget USD interno arbitrário; Paid Tier comercial bloqueado até valores explícitos | **APPROVED** (modo do piloto) / **DEFERRED_WITH_GATE** (valores do Paid Tier) | P4-02 modo A, P6-00 (framing) | P4-02 modo B (valores), ativação comercial Paid |
| [D5](#d5--coorte-do-piloto) | Teto de 200 usuários cadastrados (não meta) | **APPROVED** | P6-01, P6-02 | — |
| [D6](#d6--janela-do-piloto) | Janela de 4 semanas | **APPROVED** | P6-01, P6-02 | — |
| [D7](#d7--retenção-de-auditlog-durante-o-piloto) | `AuditLog`: sem purga automática durante o piloto | **APPROVED** (política do piloto) / **DEFERRED_WITH_GATE** (prazo legal/comercial definitivo) | — (mantém comportamento atual) | Comercialização, até parecer jurídico |
| [D8](#d8--tetos-internos-de-requisições-do-modo-a-p4-02) | Modo A: 18 requests/dia (global) e 5/dia (por usuário); tokens **deliberadamente sem teto** | **APPROVED** (requests) / **DEFERRED_WITH_GATE** (teto de tokens, por ausência de dado empírico) | P4-02 | Modo B (custo) segue bloqueado; teto de tokens aguarda telemetria real do piloto |

---

## D1 — Máximo de itens por DANFE

- **Status:** APPROVED
- **Decisão:** Máximo de **100 itens/linhas de produto** por DANFE durante o piloto.
- **Responsável:** Project Owner / responsável humano pelo piloto.
- **Data:** 2026-08-28
- **Justificativa:** Limite operacional do piloto, não regra fiscal permanente. Estabelece um teto finito e conhecido de chamadas `product_similarity` por requisição, pré-condição para que qualquer guard de orçamento (P4-02) tenha significado.
- **Interpretação registrada:**
  - conta **linhas de produto extraídas**, não unidades/quantidade;
  - 100 itens são aceitos; acima de 100, a requisição é rejeitada de forma controlada (422, antes de qualquer chamada de IA);
  - não é regra fiscal — é operacional e específica do piloto.
- **Destrava:** P4-01 (implementação do limite em `danfeResponseSchema` + `maxItems` no prompt do Gemini).
- **Condição de revisão:** reavaliar com evidência real de distribuição de itens por DANFE durante a janela do piloto (P6-02/P6-03) — o valor pode subir ou descer conforme o dado real.

---

## D2 — Retenção de `ai_call_events`

- **Status:** APPROVED
- **Decisão:** **60 dias.** Registros de `ai_call_events` com mais de 60 dias podem ser removidos pela política de retenção correspondente (P3-03).
- **Responsável:** Project Owner / responsável humano pelo piloto.
- **Data:** 2026-08-28
- **Justificativa:** Cobre o objetivo de telemetria operacional (custo/uso de IA, latência, erros, avaliação do piloto) com folga sobre a janela de 4 semanas decidida em D6, sem reter dado além do necessário para a análise de saída do piloto (P6-03).
- **Escopo explícito:** aplica-se **somente** a `ai_call_events` (tabela ainda não implementada — P3-01). **Não se aplica a `AuditLog`** (ver D7) nem ao `ai_usage_ledger`, que nunca é apagado por nenhuma política de retenção (já registrado em P3-03 como critério de aceite).
- **Destrava:** a parte de retenção de P3-03 (consulta/runbook de telemetria).
- **Condição de revisão:** nenhuma — 60 dias é o valor operacional para a duração do piloto; pode ser revisto para operação comercial com dado real de uso das consultas de P3-03.

---

## D3 — Password management pré-piloto

- **Status:** APPROVED (escopo funcional) / **DEFERRED_WITH_GATE** (escolha de provedor de e-mail)
- **Decisão:** Password management passa a ser **requisito antes do piloto** (deixa de ser *Should have* / pós-piloto). Escopo aprovado:
  - **A. Troca de senha autenticada** — usuário logado troca a própria senha (já era o escopo de P2-02, mantido).
  - **B. Recuperação por e-mail** — usuário que esqueceu a senha recebe um **código temporário** por e-mail; após validar o código, define nova senha.
- **Responsável:** Project Owner / responsável humano pelo piloto.
- **Data:** 2026-08-28
- **Requisitos conceituais aprovados para a recuperação (B):**
  - não revelar se um e-mail específico possui conta (mensagem/status genéricos, igual para e-mail existente ou não);
  - código temporário, não a senha em si;
  - expiração curta;
  - uso único (código consumido após validação bem-sucedida, ou após uso, o que ocorrer primeiro);
  - limite de tentativas de validação do código;
  - rate limiting dedicado (mesmo padrão de `uploadRateLimiter`/demais rotas sensíveis);
  - armazenar **somente hash/representação segura do código**, nunca o código em texto puro;
  - a troca de senha (via A ou via B) invalida credenciais anteriores por mecanismo equivalente a `authVersion` (o mesmo mecanismo já desenhado em P2-02).
- **Decisão explícita sobre escopo de tarefa:** o P2-02 original (troca autenticada, com `authVersion`) **não é redefinido para cobrir recuperação por e-mail** — isso distorceria seu escopo e seus critérios de aceite já escritos. Recuperação por e-mail passa a ser uma tarefa nova e explícita: **P2-03**, no roadmap.
- **Dependência explicitamente NÃO resolvida aqui:** a escolha do **provedor de e-mail** (Resend, SendGrid, SES, ou qualquer outro) **não foi feita** nesta decisão e não deve ser inferida ou escolhida pelo agente. P2-03 fica formalmente **bloqueada** por essa escolha até o responsável humano decidir.
- **Destrava:** reclassificação de prioridade de P2-02 (de *Should have* para *Must have antes do piloto*); criação da tarefa P2-03 no roadmap.
- **Bloqueia:** implementação de P2-03, até a escolha do provedor de e-mail.
- **Condição de revisão:** nenhuma pendente para P2-02 (escopo já definido). P2-03 revisitada assim que o provedor de e-mail for escolhido pelo responsável humano.

---

## D4 — Gemini / budget durante o piloto

- **Status:** APPROVED (modo do piloto: Free Tier) / **DEFERRED_WITH_GATE** (valores de budget do Paid Tier comercial)
- **Decisão:** O piloto usa **Gemini Free Tier**. Não haverá budget monetário interno arbitrário em USD enquanto o piloto operar em Free Tier — a cota do próprio provedor é o limite externo (já é exatamente o desenho do "Modo A" de P4-02: tetos internos de requisições/tokens, sem dimensão de custo). Quando a cota estiver indisponível/esgotada, o sistema falha de forma controlada, preservando a distinção já implementada entre `unavailable` (indisponibilidade de IA) e `no_match` (ausência legítima de correspondência) — nenhum fallback sem IA que altere essa semântica.
- **Responsável:** Project Owner / responsável humano pelo piloto.
- **Data:** 2026-08-28
- **Gate para Paid Tier / uso comercial:** o Paid Tier **não pode ser habilitado comercialmente** sem, simultaneamente:
  1. budget guard implementado (P4-02, Modo B);
  2. limite **diário** explicitamente configurado, em valor concreto;
  3. limite **mensal** explicitamente configurado, em valor concreto;
  4. reserva/controle atômico conforme o desenho já registrado em P4-02;
  5. evidência de telemetria real do piloto (custo médio/p95 por DANFE, volume observado) para calibrar os valores acima.
- **Explicitamente, os valores em USD diário/mensal NÃO são inventados agora.** Isso não é uma decisão esquecida — é uma decisão **deliberadamente adiada** até existir evidência (P6-02/P6-03) suficiente para calcular valores responsáveis, cruzada com a tolerância financeira do negócio (que também não foi declarada e não deve ser presumida).
- **Gate registrado explicitamente:** **Free Tier pilot = permitido** (já satisfaz o desenho de Modo A de P4-02, sem alteração de código necessária para isso). **Paid commercial = bloqueado** até os quatro itens acima existirem com valores concretos. `P6-00` deve verificar esse gate antes de qualquer ativação comercial em Paid Tier.
- **Destrava:** framing de P4-02 (Modo A confirmado como suficiente para o piloto); P6-00 (linguagem do gate).
- **Bloqueia:** P4-02 Modo B com valores reais; qualquer ativação de billing/Paid Tier para uso comercial.
- **Condição de revisão:** ao final da janela do piloto (P6-02/P6-03), com dado real de custo médio/p95 por DANFE e volume observado.

---

## D5 — Coorte do piloto

- **Status:** APPROVED
- **Decisão:** Máximo de **200 usuários cadastrados** durante o piloto.
- **Responsável:** Project Owner / responsável humano pelo piloto.
- **Data:** 2026-08-28
- **Interpretação registrada:** 200 é **teto**, não meta obrigatória. O piloto **não precisa** atingir 200 cadastros para ser considerado válido. A suficiência do piloto deve considerar evidência de uso real — não apenas o número bruto de cadastros —, podendo incluir (sem que isso seja um mínimo numérico inventado agora): usuários ativos, DANFEs efetivamente processadas, volume de decisões de matching (confirm/reject), erros/falhas, consumo de cota de IA, período de observação.
- **Nota de escopo:** esta decisão fixa **tamanho** (teto). A **composição** da coorte (quem especificamente é convidado, critério de seleção de participantes) não foi especificada e não é exigida por nenhum critério de aceite hoje escrito em P6-01 — permanece uma escolha operacional do responsável humano no momento do convite, não uma decisão bloqueante de nenhuma tarefa.
- **Destrava:** P6-01 (provisionamento de coorte), P6-02 (janela de observação).
- **Condição de revisão:** nenhuma — é o teto para esta janela do piloto; pode ser revisto para uma eventual expansão pós-piloto.

---

## D6 — Janela do piloto

- **Status:** APPROVED
- **Decisão:** **4 semanas.**
- **Responsável:** Project Owner / responsável humano pelo piloto.
- **Data:** 2026-08-28
- **Justificativa:** Substitui a faixa aberta de 2–4 semanas (estimativa anterior do roadmap) por um valor concreto e planejável.
- **Destrava:** P6-01 (planejamento do início), P6-02 (duração da janela de observação).
- **Condição de revisão:** ao final das 4 semanas, em P6-03 (relatório de saída) — pode ser estendida se o volume de uso real for insuficiente para responder às perguntas de §12 do roadmap, conforme a própria regra já registrada em P6-02 ("a janela termina quando os critérios objetivos forem atendidos, ou quando ficar claro que a coorte não gera esse volume").

---

## D7 — Retenção de `AuditLog` durante o piloto

- **Status:** APPROVED (política do piloto) / **DEFERRED_WITH_GATE** (prazo legal/comercial definitivo)
- **Decisão:** **Não haverá exclusão automática de `AuditLog` durante o piloto.** Mantém-se o comportamento conservador já implementado: append-only, sem TTL, sem purge automático, sem cron de exclusão — nenhuma mudança de comportamento real é feita por esta decisão.
- **Responsável:** Project Owner / responsável humano pelo piloto.
- **Data:** 2026-08-28
- **Explicitamente fora desta decisão:** nenhum prazo fiscal foi inferido. Nenhum número ("5 anos", "1 ano", "60 dias" ou qualquer outro) é registrado como obrigação legal de guarda de `AuditLog`. A obrigação fiscal do **cliente** de guardar sua própria NF-e/DANFE **não é presumida** como obrigação de retenção do **DocScan SaaS** — são coisas distintas, e nenhuma equivalência entre elas foi declarada aqui.
- **Classificação para efeito de P0-01:**
  - **Política do piloto:** DECIDIDA — sem exclusão automática, mantendo o comportamento já documentado desde M5-01.
  - **Prazo legal/comercial definitivo:** **DEFERRED COMPLIANCE GATE** — permanece aberto, a ser resolvido com avaliação jurídica/compliance apropriada **antes da comercialização**, não antes do piloto. A ausência de prazo definitivo **não bloqueia** o piloto.
- **Achados técnicos relacionados** (investigação read-only desta sessão, sem alteração de código): dois gaps de cobertura/estrutura foram identificados e registrados como tarefas novas no roadmap — ver P3-00A e P3-00B em `docs/pilot-readiness-roadmap.md`.
- **Destrava:** nada muda tecnicamente — mantém P3-03 explicitamente proibida de tocar `AuditLog` (já era o caso).
- **Bloqueia:** nada no piloto. O gate de compliance definitivo bloqueia apenas a **comercialização**, não a execução do piloto.
- **Condição de revisão:** antes de qualquer plano de comercialização, com parecer jurídico sobre prazo de guarda de dado fiscal brasileiro aplicável ao DocScan como operador de SaaS (não ao cliente).

---

## D8 — Tetos internos de requisições do Modo A (P4-02)

- **Status:** APPROVED (tetos de requisições) / **DEFERRED_WITH_GATE** (teto de tokens).
- **Data:** 2026-09-03.
- **Responsável:** Project Owner / responsável humano pelo piloto.

**Evidência humana do Google AI Studio, registrada sem interpretação:**

| Item | Valor observado |
|---|---|
| Projeto | Default Gemini Project |
| Tier | Nível gratuito |
| Modelo | `gemini-2.5-flash` |
| RPM | 5 requisições/minuto |
| TPM | 250.000 tokens de entrada/minuto |
| RPD | 20 requisições/dia |
| TPD | **Não apresentado/publicado na tela do AI Studio.** |

**Interpretação registrada sobre a ausência de TPD — explícita, para nunca ser reaberta por engano:** a ausência de um valor de TPD na tela do AI Studio **não** significa zero, não significa ilimitado, e não é `TPM × 60 × 24` nem qualquer outro número derivado. É, simplesmente, um dado que o provedor não publica nessa tela. Nenhum desses valores foi inferido.

**Decisão — requisições/dia (Modo A, `docs/pilot-readiness-roadmap.md`, P4-02):**
- **Teto global: 18 requisições/dia.** O teto global **sempre prevalece** sobre qualquer teto por usuário.
- **Teto por usuário: 5 requisições/dia.** É um mecanismo **anti-monopolização** — impede que um único usuário consuma sozinho a cota compartilhada — e **não** é uma reserva nem uma garantia individual. Em particular: o teto de coorte de até 200 usuários registrados (D5) **não** implica `5 × 200` requisições disponíveis; a autoridade final é sempre o teto global de 18/dia.
- Ambos os valores são deliberadamente **inferiores** à cota real do provedor (RPD=20): a aplicação recusa antes que o provedor recuse.

**Decisão — tokens: SEM teto interno nesta primeira configuração do Modo A. Deliberado, não uma omissão.**

Motivo, registrado explicitamente para não ser confundido com esquecimento: não existe, hoje, base empírica suficiente para escolher um `GLOBAL_TOKENS_PER_DAY`/`USER_TOKENS_PER_DAY` responsável. Investigação read-only confirmou, antes desta decisão:
- o piloto ainda não começou (nenhuma coorte real gerando tráfego);
- os únicos dados já persistidos em `ai_call_events` são sintéticos (fixtures do gate de integração) ou foram descartados junto com o container Docker efêmero ao final de cada execução;
- o AI Studio fornece TPM (por minuto) para `gemini-2.5-flash`, mas **não** fornece um TPD (por dia) equivalente — não há de onde derivar um teto diário de tokens sem inventar uma fórmula de conversão que ninguém aprovou.

Consequência técnica, não uma segunda decisão pendente: o mecanismo do ledger (`ai_usage_ledger`, P4-02) já foi desenhado para que **um teto ausente signifique "sem limite nesta dimensão"**, não zero e não infinito por acidente de código. Tokens continuam sendo **observados** — `ai_call_events` (P3-01) já captura `inputTokens`/`outputTokens`/`totalTokens`/`estimatedCostUsdNanos` reais de cada chamada, e o próprio `ai_usage_ledger` acumula `spentTokens`/`spentCostUsdNanos` desde já, sem teto configurado — para que, quando houver telemetria real do piloto, a decisão do teto de tokens seja tomada com dado, não com uma fórmula inventada agora.

**Explicitamente fora desta decisão:**
- Qualquer valor de `GLOBAL_TOKENS_PER_DAY`/`USER_TOKENS_PER_DAY` — nenhum foi fixado, nenhum foi derivado de TPM.
- Modo B (Paid Tier comercial) — permanece bloqueado por D4, sem relação com esta decisão. **Os valores 18/5 não devem ser reutilizados como política comercial** caso o Modo B seja decidido no futuro; são calibrados especificamente contra a cota gratuita do projeto de desenvolvimento.
- RPM (5) e TPM (250.000) são constraints **externas do provedor**, não tetos internos — a aplicação não os replica como configuração própria; eles seguem relevantes apenas para a política de retry (não repetir `429`, já registrada na tarefa).

**Destrava:** implementação de P4-02 (Modo A completo: tetos de requisições, kill switch, fail-closed, tokens observados sem teto).
**Bloqueia:** nada no piloto — Modo A está completo com esta decisão. Modo B (custo) e um futuro teto de tokens continuam **DEFERRED_WITH_GATE**, cada um aguardando sua própria evidência.
**Condição de revisão:** teto de tokens revisitado com dado real de `ai_call_events`/`ai_usage_ledger` do próprio piloto (P3-04, P6-02/P6-03); tetos de requisições (18/5) revisitados se o volume real do piloto (P6-02) sugerir recalibração.

---

## Decisões que permanecem fora deste documento

D1–D7 foram tomadas em 2026-08-28 (fechamento de P0-01); D8 foi tomada em 2026-09-03 (evidência real do Google AI Studio para `gemini-2.5-flash`, destravando P4-02 Modo A). Nenhuma outra decisão foi solicitada ou tomada. Qualquer outra "decisão humana" ainda referenciada no roadmap (`docs/pilot-readiness-roadmap.md`) que não apareça acima continua **aberta**, e não foi resolvida por inferência — ver o relatório de fechamento de P0-01 para a lista exata verificada contra os critérios do roadmap.
