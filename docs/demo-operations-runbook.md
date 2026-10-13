# Runbook operacional mínimo — demonstração DocScan (DP-04)

Escopo: demonstração de portfólio com dados **sintéticos**, descartáveis. Não é runbook de produto comercial (sem SLA, RPO/RTO, plantão). Cada procedimento tem sintoma, diagnóstico seguro, ação, resultado esperado e condição de escalonamento. Nenhum comando abaixo imprime segredo; nunca cole valores de `DATABASE_URL`, `JWT_SECRET`, `GEMINI_API_KEY` ou `INVITE_CODE` em chamados, logs ou capturas.

Convenções: "painel" = painel do Render/Neon (acesso do operador); "banco" = consulta SQL com a conexão **direta** do Neon, sempre começando por `SELECT`. Consultas de telemetria completas: [telemetry-runbook.md](telemetry-runbook.md).

> **Estado:** este runbook foi escrito e os comandos locais foram ensaiados contra banco efêmero. Nenhum procedimento foi executado contra o ambiente hospedado (ver [evidência DP-04](evidence/DP-04.md)).

## 1. Provedor de IA em 429/503

- **Sintoma:** upload responde `503` com "O serviço de IA atingiu um limite temporário…" (ou "análise de similaridade indisponível"); a interface mostra aviso de indisponibilidade e oferece nova tentativa manual.
- **Diagnóstico seguro:** contar falhas recentes por categoria — `provider_rate_limit` é HTTP 429 do Gemini; `provider_error`/`timeout` são outras falhas.
  ```sql
  SELECT "failureCategory", count(*) FROM ai_call_events
  WHERE status = 'failure' AND "createdAt" > now() - interval '1 hour' GROUP BY 1;
  ```
  Confirme também no console do provedor, sem alterar a conta. Nenhuma nota é alterada em caso de recusa (a nota é abortada antes da transação).
- **Ação:** suspender tentativas repetidas (visitantes e operador); tentar manualmente mais tarde. **Não** reiniciar o serviço, **não** aumentar tentativas (`GEMINI_MAX_ATTEMPTS`) e **não** prometer horário de recuperação: o serviço não repete 429 por desenho.
- **Resultado esperado:** novas notas voltam a processar quando o provedor aceitar chamadas; telemetria passa a registrar `success`.
- **Escalonar se:** `provider_error` persiste por horas com o provedor saudável (possível mudança de contrato do SDK/modelo) ou `unknown` aparece — abrir investigação com `requestId` dos eventos.

## 2. Kill switch da IA

- **Sintoma/objetivo:** interromper imediatamente novas chamadas de IA (custo inesperado, abuso, incidente com o provedor).
- **Diagnóstico seguro:** `GET /health` continua 200; uploads passam a responder `503` sem `Retry-After`.
- **Ação:** no painel, definir `GEMINI_ENABLED=false` e salvar (reinicia o processo). Solicitações **já em andamento** terminam ou falham conforme o estado delas; apenas as novas são recusadas. Reativar com `GEMINI_ENABLED=true`.
- **Resultado esperado:** zero novos eventos em `ai_call_events` após o reinício; resto do sistema (login, estoque, sessões, PDFs) intacto.
- **Escalonar se:** eventos de IA continuarem após o reinício (variável não aplicada).

## 3. Banco indisponível

- **Sintoma:** `/health` responde `503 {"status":"unavailable"}`; logins e uploads falham com erro interno. O Neon Free "adormece" e o primeiro acesso após ociosidade é lento — diferenciar de queda.
- **Diagnóstico seguro:** repetir `/health` após alguns segundos (cache de sucesso de 5 s; falhas nunca entram no cache); olhar o estado do projeto no painel do Neon. Logs mostram apenas o nome do erro, sem credenciais.
- **Ação:** aguardar o despertar; se o projeto estiver suspenso/pausado, retomá-lo no painel. Não alterar `DATABASE_URL` em pânico (build usa a conexão **direta**, runtime a **pooled**).
- **Resultado esperado:** `/health` volta a 200; o smoke (procedimento 7) passa.
- **Escalonar se:** o banco estiver saudável no painel e o serviço continuar `503` (problema de conexão/pool) ou o limite do plano gratuito tiver sido atingido.
- **Importante:** requisições que estavam em curso têm resultado **desconhecido**; não afirmar a visitantes que foram revertidas (ver 4).

## 4. Nota duplicada ou resultado desconhecido

- **Sintoma:** visitante recebeu `409` "já foi processada", ou perdeu a resposta (timeout/rede) e não sabe se a nota entrou.
- **Diagnóstico seguro:** a chave de acesso é única; consultar sem expor dados do documento:
  ```sql
  SELECT id, "stockId", "correlationId", "createdAt" FROM processed_invoices WHERE "accessKey" = '<chave de 44 dígitos>';
  SELECT operation, status, "failureCategory", "createdAt" FROM ai_call_events WHERE "correlationId" = '<correlationId acima>';
  ```
  Ou pedir ao visitante que use "Atualizar" na interface: ela relê estoque e sugestões.
- **Ação:** se a nota consta em `processed_invoices`, ela foi aplicada (estoque e sugestões pendentes refletem isso); **não** reenviar. Se não consta, o reenvio é seguro.
- **Resultado esperado:** estoque consistente; nenhuma dupla contagem (a chave é única e a transação é atômica).
- **Escalonar se:** a nota consta processada mas o estoque não reflete (violaria a atomicidade) — preservar `correlationId` e abrir incidente de dados.

## 5. Perda de acesso de um visitante

- **Sintoma:** visitante perdeu a senha. Não há recuperação por e-mail e **não existe endpoint administrativo público** (decisão de escopo).
- **Diagnóstico seguro:** não pedir a senha antiga; confirmar identidade pelo canal em que o convite foi dado.
- **Ação:** orientar a criar **nova conta** com o convite vigente e outro e-mail (os dados da conta antiga não são recuperados, o que é aceito: dados são descartáveis). Para invalidar tokens da conta antiga e marcá-la, com escopo explícito:
  ```sql
  SELECT id, email FROM users WHERE email = '<email antigo>';              -- conferir 1 linha
  UPDATE users SET "authVersion" = "authVersion" + 1 WHERE id = '<id da linha acima>';
  ```
  Isso revoga sessões emitidas; não altera a senha nem apaga dados.
- **Resultado esperado:** a conta antiga não autentica com tokens anteriores; a nova conta é isolada (empresa, estoque e documentos próprios).
- **Escalonar se:** houver suspeita de abuso do convite — rotacionar `INVITE_CODE` (reinicia o serviço; não afeta contas existentes).

## 6. Reconstrução de ambiente sintético

- **Sintoma/objetivo:** reiniciar um ambiente de visitante ou liberar dados de demonstração antigos.
- **Ação preferida:** o próprio visitante usa "Reiniciar ambiente" (`POST /demo/sessions/:id/restart`): arquiva a sessão e entrega estoque vazio com chaves novas, sem apagar nada compartilhado.
- **Limpeza pelo operador (opcional):** **nunca** `TRUNCATE` nem `DELETE` sem `WHERE`. Primeiro listar candidatos explicitamente (somente sessões arquivadas, ids visíveis):
  ```sql
  SELECT s.id AS session_id, s."companyId", s."archivedAt" FROM demo_sessions s
  WHERE s.state = 'ARCHIVED' AND s."archivedAt" < now() - interval '30 days';
  ```
  Remover por **IDs conferidos**, dentro de transação, verificando a contagem antes do `COMMIT` (a remoção da empresa cascateia estoques, produtos, sugestões, notas e a sessão):
  ```sql
  BEGIN;
  DELETE FROM companies WHERE id IN ('<companyId 1>', '<companyId 2>');   -- IDs da listagem acima
  -- conferir "DELETE n" == número de IDs; senão ROLLBACK
  COMMIT;
  ```
  Não toca `ai_usage_ledger` nem `ai_call_events`.
- **Ensaio completo do zero (somente banco efêmero):** `node scripts/rehearse-release.mjs` (ver evidência DP-04).
- **Escalonar se:** `DELETE` afetar mais linhas que as esperadas — `ROLLBACK`.

## 7. Rollback da aplicação

- **Quando:** release candidata com regressão confirmada.
- **Pré-condições:** SHA anterior conhecido (painel do Render lista deploys; `GET /version` informa o SHA em execução); migrations são **expand/contract**: a versão anterior precisa rodar sobre o schema novo (verificado no ensaio local DP-04 e na evidência DP-01/DP-02).
- **Ação:** no painel do Render, "Rollback" para o deploy anterior. **Migrations não são desfeitas** (todas as desta release são aditivas). Comunicar indisponibilidade breve a quem estiver testando.
- **Verificação (sem IA):**
  ```sh
  SMOKE_BASE_URL=https://<servico> SMOKE_EMAIL=<conta-de-teste> SMOKE_PASSWORD=<senha> \
  SMOKE_SKIP_DEMO=true SMOKE_SKIP_VERSION=true node scripts/smoke-demo.mjs
  ```
  (a release anterior à DP-02/04 não tem `/demo` nem `/version`; com a candidata, omitir os dois `SKIP_*` e usar `SMOKE_EXPECT_SHA=<sha>`.)
- **Resultado esperado:** todas as verificações `ok`; `/health` 200.
- **Escalonar se:** a release anterior falhar sobre o schema novo (violação de compatibilidade) — corrigir a migration seguinte em vez de tentar reverter dados.

## 8. Telemetria, retenção e reconciliação

- **Consultas:** [telemetry-runbook.md](telemetry-runbook.md) (latência, tokens por nota, falhas por categoria, sugestões por decisão).
- **Retenção:** `ai_call_events` guarda 60 dias; `npm run retention:ai-call-events` (a partir da máquina do operador, contra a conexão direta) expurga o excedente. Não faz parte do ciclo de deploy.
- **Reconciliação:** `npm run reconcile:ai-usage` compara `ai_usage_ledger` com `ai_call_events`, **somente leitura**. A reserva usa o dia de **início** da chamada e o evento pode terminar no dia seguinte: uma divergência à meia-noite não é, por si só, vazamento de cota. Investigar os dois dias antes de concluir perda.
- **Sem tetos:** com `GEMINI_QUOTA_ENFORCEMENT_ENABLED=false` o ledger acima de 18/5 é esperado. Reservas residuais (`reservedRequests > 0` de dias anteriores) continuam exigindo investigação.
- **Escalonar se:** reserva residual persistente ou ausência total de eventos com tráfego (telemetria best-effort falhando silenciosamente).

## 9. Temporários e logs

- **Temporários:** uploads vão para `tmp/` e são removidos ao fim de cada requisição (sucesso, erro, acesso negado e formato recusado). Sinal de problema: crescimento contínuo de `tmp/`. No Render Free o disco é efêmero e zera a cada deploy; mesmo assim, não deixar acumular.
- **Logs:** estruturados e redigidos (chaves sensíveis por nome); não contêm documento, `accessKey`, senha, JWT nem convite. Ao compartilhar evidência, usar apenas IDs de correlação e categorias.
- **Material público:** capturas e vídeos só com dados sintéticos; nunca mostrar painel com variáveis de ambiente, URLs de banco ou o convite.
- **Escalonar se:** aparecer documento, chave ou credencial em log — tratar como incidente de segurança e rotacionar o segredo afetado.

## 10. Identidade do visitante atrás do Render (D03)

**Problema.** O Render recebe o tráfego pelo Cloudflare e por um balanceador próprio. Com `TRUST_PROXY_HOPS=1`, o limitador usa a borda do Cloudflare como identidade (visitantes compartilham baldes; um visitante cai em baldes diferentes). Com `2`, a cadeia completa funciona, mas um pedido que chegue sem o Cloudflare permite que um valor forjado de `X-Forwarded-For` vire a identidade.

**Modo `TRUST_PROXY_MODE=render-cloudflare`** (`src/config/trusted-proxies.ts`):

| Posição na cadeia | Confiança |
|---|---|
| 0 — socket (roteamento do Render) | confiável **por posição**; a faixa não é documentada e redes privadas não são confiadas |
| 1 — último item do `X-Forwarded-For` | confiável **somente** se estiver nas faixas oficiais do Cloudflare |
| demais | nunca avaliados: o primeiro endereço não confiável é o visitante |

**Premissas (a reavaliar se mudarem):** serviço público `*.onrender.com`, sem domínio próprio nem outro proxy; o Render só entrega pedidos pelo seu roteamento (documentação: serviço "not directly reachable via the public internet"); a cadeia é Cloudflare → balanceador do Render → app (descrita em artigos da Render, **sem garantia contratual**). O modo só inicia com `RENDER=true`.

**Falhas seguras:** borda fora da lista → identidade = a borda (comportamento de 1 salto: colapsa, não permite forjar); cadeia sem Cloudflare → identidade = o último salto real.

**Atualizar as faixas do Cloudflare** (revisar a cada trimestre ou quando o aceite A3 acusar colapso):
1. `node scripts/check-cloudflare-ips.mjs` (exit 0 = idênticas, 1 = divergem).
2. Se divergir, atualizar `src/config/cloudflare-ip-ranges.ts`, a data `CLOUDFLARE_IP_RANGES_FETCHED_AT` e as contagens em `trusted-proxies.spec.ts`; `npm run build`, testes e `verify:artifacts`.

**Ativar / validar (somente com `GET /version`, sem login — limite de 60/min por identidade):**
1. Implantar a release que contém o modo e, no painel, definir `TRUST_PROXY_MODE=render-cloudflare`, **removendo** `TRUST_PROXY_HOPS` (ou `0`).
2. A1: 15 requisições do mesmo cliente → `RateLimit-Remaining` estritamente decrescente (um único balde).
3. A2: com `X-Forwarded-For` forjado variável o contador continua na mesma sequência.
4. A3: um segundo IP real (outra rede) começa em 59 enquanto o primeiro está mais baixo.
5. A4: após a janela, login normal responde 200 (não 429).
6. Rollback: remover `TRUST_PROXY_MODE` e restaurar `TRUST_PROXY_HOPS=1` (valor anterior).
