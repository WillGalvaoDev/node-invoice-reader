# Backlog de Engenharia — DocScan

**Origem:** `docs/auditoria-tecnica.md` (branch `audit/claude-review`, HEAD `71e45ed`)
**Natureza:** plano de execução derivado da auditoria. Nenhum problema novo foi introduzido — cada tarefa referencia os itens de origem.

## Convenções

| Campo | Escala |
|---|---|
| **Esforço** | **S** ≤ 1 dia · **M** 1–3 dias · **L** > 3 dias |
| **Risco** | risco *da alteração em si* (de quebrar o que funciona), não do problema |
| **Prioridade** | **P0** bloqueia o marco · **P1** obrigatório no marco · **P2** desejável · **P3** oportunista |

**Portão de produção:** Milestones **1 a 4** são pré-produção. Milestones **5 e 6** são pós-lançamento, orientados por dados reais de uso.

## Calibrações aplicadas a partir das respostas do time

Sete decisões alteraram a priorização original da auditoria. Registro apenas o delta:

| Resposta | Efeito no backlog |
|---|---|
| Postgres gerenciado com pool baixo | **M1-02** sobe de "alta" para bloqueador P0 |
| Só dependências de produção instaladas | **M1-03** deixa de ser hipótese e vira defeito confirmado |
| Ciclo de sugestões: confirmar/rejeitar, entrada só após confirmação | **M3-02** ganha escopo definido (entidade + endpoints), sai de "lacuna" para feature especificada |
| Custeio: média ponderada | **M3-01** deixa de depender de decisão de negócio — está resolvido |
| Volume MVP, mas com proteções obrigatórias | **M2-05** (não enviar estoque inteiro ao modelo) sobe para pré-produção; otimização fina de custo permanece em M5 |
| Instância única | **M2-01** dispensa store compartilhado de rate limit; `trust proxy` permanece necessário |
| `engineType` sem motivo confirmado | **M4-07** vira tarefa de verificação, não de remoção |

---

---

# Milestone 1 — Bloqueadores de produção

*Objetivo: o sistema para de cair, para de corromper saldo e para de vazar entre empresas. Nenhum deploy antes da conclusão integral.*

---

### M1-01 · Corrigir registro de rotas e fazer `AppError` estender `Error`

**Status:** Concluída em 2026-08-13.

**Evidência de validação:** teste HTTP confirma que rejeições assíncronas chegam ao error handler sem `unhandledRejection` e preserva o sucesso; teste unitário confirma `AppError instanceof Error`, `statusCode` e stack trace. Suíte completa: 24/24; typecheck e build concluídos.

**Descrição**
Substituir os wrappers que descartam a Promise nas quatro rotas afetadas pelo padrão já usado corretamente na rota de upload, e fazer `AppError` herdar de `Error` para restaurar stack trace.
*Itens de origem: 3.3*

| | |
|---|---|
| **Dependências** | nenhuma |
| **Esforço** | **S** |
| **Risco** | **Baixo** — quatro linhas de rota; a suíte atual continua passando |
| **Prioridade** | **P0** |
| **Impacto** | Elimina DoS remoto comprovado (exit code 1 reproduzido). Restaura diagnosticabilidade de toda exceção do sistema. Maior retorno absoluto do backlog. |

---

### M1-02 · Unificar o cliente Prisma em módulo único

**Status:** Concluída em 2026-08-13.

**Evidência de validação:** testes confirmam um único `Pool`, `PrismaPg` e `PrismaClient` compartilhado pelos cinco repositórios, pool com `max: 10` e encerramento explícito de cliente/pool. Suíte completa: 27/27; typecheck e build concluídos.

**Descrição**
Extrair a instanciação de `Pool`/`PrismaPg`/`PrismaClient` para um módulo único importado pelos cinco repositórios. Configurar `max` do pool de forma explícita e compatível com o limite do provedor gerenciado, e encerrar o pool no shutdown.
*Itens de origem: 7.1*

| | |
|---|---|
| **Dependências** | nenhuma |
| **Esforço** | **S** |
| **Risco** | **Baixo** — refatoração mecânica, sem mudança de comportamento |
| **Prioridade** | **P0** |
| **Impacto** | Reduz de ~50 para ~10 conexões. Com Postgres gerenciado de plano de entrada, as cinco pools esgotam o limite da instância e derrubam o banco para toda a aplicação. **Pré-requisito técnico obrigatório de M1-05** — não há transação entre repositórios com clientes distintos. |

---

### M1-03 · Declarar dependências de runtime e centralizar configuração

**Status:** Concluída em 2026-08-13.

**Evidência de validação:** `dotenv` declarado diretamente em produção; configuração única valida `DATABASE_URL`, `JWT_SECRET`, `GEMINI_API_KEY` e `PORT` (default 3333). Instalação isolada com `npm ci --omit=dev` validada; suíte completa: 32/32; typecheck e build concluídos.

**Descrição**
Mover `dotenv` para `dependencies` e auditar o restante do manifesto contra o que é importado em runtime. Criar um módulo único de configuração que valide e falhe rápido em todas as variáveis obrigatórias (`DATABASE_URL`, `JWT_SECRET`, chave do Gemini, `PORT`).
*Itens de origem: 1.7*

| | |
|---|---|
| **Dependências** | nenhuma |
| **Esforço** | **S** |
| **Risco** | **Baixo** |
| **Prioridade** | **P0** |
| **Impacto** | A aplicação precisa rodar só com dependências de produção. Hoje `dotenv` chega por transitividade de uma devDependency — o boot falha exclusivamente em produção, depois de passar em todos os testes locais. O fail-fast unificado transforma erro de configuração em falha de boot explícita em vez de erro em runtime. |

---

### M1-04 · Implementar autorização real de acesso a estoque

**Status:** Concluída em 2026-08-13.

**Evidência de validação:** testes confirmam entrada permitida ao owner e ao collaborator com `StockPermission.canCreate=true`; outsider e collaborator sem permissão recebem 403 antes do Gemini e sem escrita de produto, com auditoria independente de `companyId` do cliente. Suíte completa: 37/37; typecheck e build concluídos.

**Descrição**
Introduzir no `IStockRepository` o método que relaciona estoque e usuário, e substituir a verificação de existência por verificação de autorização em toda escrita. Ativar `CompanyCollaborator`/`StockPermission`, ou — se as permissões granulares ficarem para depois — autorizar minimamente via propriedade da empresa, deixando o ponto de extensão explícito.
*Itens de origem: 1.1 (base para 7.2)*

| | |
|---|---|
| **Dependências** | M1-02 |
| **Esforço** | **M** |
| **Risco** | **Médio** — altera quem acessa o quê; exige teste cuidadoso para não bloquear o dono legítimo |
| **Prioridade** | **P0** |
| **Impacto** | Fecha escrita cross-tenant: hoje qualquer usuário autenticado altera o estoque de qualquer empresa. Sem isso o sistema não pode receber dados de mais de um cliente. Habilita M3-05 e cobre também a exigência de "consumo causado por usuário não autorizado". |

---

### M1-05 · Upsert atômico e transação por nota

**Status:** Concluída em 2026-08-13.

**Evidência de validação:** persistência agrupada em uma única transação por nota, com o mesmo transaction client para upserts e auditoria e `increment` atômico de quantidade. Além da cobertura unitária, o PostgreSQL Integration Gate executado em 2026-08-13 provou rollback de nota com dois itens (segundo item provoca erro real de `DECIMAL`, deixando zero produtos, zero `ProcessedInvoice` e zero auditorias de sucesso) e duas entradas concorrentes no mesmo produto: quantidade inicial 10, incrementos 7 e 11, quantidade final observada 28, sem lost update. Pendência PostgreSQL encerrada.

**Descrição**
Substituir o `read-modify-write` do saldo por operação atômica (`increment` / `upsert` sobre a chave composta) e envolver o processamento de uma nota em transação única, separando a fase de extração/decisão (fora da transação, com IA) da fase de persistência (dentro).
*Itens de origem: 3.1, 2.1*

| | |
|---|---|
| **Dependências** | M1-02 |
| **Esforço** | **L** |
| **Risco** | **Médio-alto** — reestrutura o fluxo principal; validar junto com M4-03 |
| **Prioridade** | **P0** |
| **Impacto** | Elimina lost update e persistência parcial. É o maior risco técnico do sistema: o saldo corrompe em silêncio, retorna `201` para todos, e a descoberta vem semanas depois sem histórico para reconstruir. A separação em fases também é o que viabiliza M1-06. |

---

### M1-06 · Idempotência por chave de acesso da NF-e

**Status:** Concluída em 2026-08-13.

**Evidência de validação:** chave validada como exatamente 44 dígitos e registrada na mesma transação dos itens e da auditoria, com constraint `UNIQUE` global e conflito traduzido para `409`. O PostgreSQL Integration Gate executado em 2026-08-13 disparou duas submissões concorrentes da mesma chave: uma venceu, uma retornou duplicata `409`, a quantidade final foi 6 (um único incremento), e permaneceram exatamente um produto, um `ProcessedInvoice` e uma auditoria de sucesso. A constraint real rejeitou inserção direta duplicada com Prisma `P2002`; falha posterior à criação da identidade fez rollback e permitiu nova tentativa com a mesma chave. Pendência PostgreSQL encerrada.

**Descrição**
Persistir a nota processada com constraint de unicidade sobre a chave de 44 dígitos já extraída, verificar antes de aplicar e retornar o resultado anterior em reenvio.
*Itens de origem: 3.2*

| | |
|---|---|
| **Dependências** | M1-05 |
| **Esforço** | **M** |
| **Risco** | **Baixo-médio** — aditivo; não altera o fluxo de sucesso |
| **Prioridade** | **P0** |
| **Impacto** | Atende diretamente duas exigências obrigatórias (chamadas duplicadas, reprocessamento da mesma nota). Duplo clique hoje dobra o estoque. Os defeitos de M1-05 e M1-08 **produzem** o erro que motiva o reenvio — sem idempotência, cada falha se amplifica na tentativa de correção. |

---

### M1-07 · Limites de upload, MIME correto e leitura assíncrona

**Status:** Concluída em 2026-08-13.

**Evidência de validação:** testes HTTP reais confirmam limite de 10 MiB (`413`), allowlist JPEG/PNG/PDF (`415` para tipo não suportado) e bloqueio antes do controller. Testes de controller/use case/provider confirmam propagação do MIME até o Gemini, PDF sem fallback, leitura por `fs/promises`, cleanup em sucesso, erro, validação e duplicata, além das regressões de autorização/transação/idempotência; suíte completa: 68/68. As pendências de validação PostgreSQL real registradas em M1-05 e M1-06 permanecem inalteradas.

**Descrição**
Configurar `limits` e `fileFilter` no multer, propagar o mimetype real detectado pelo multer em vez de derivá-lo da extensão (hoje sempre vazia, o que torna o caminho de PDF código morto), e trocar `readFileSync` por leitura assíncrona.
*Itens de origem: 1.4, 8.1*

| | |
|---|---|
| **Dependências** | nenhuma |
| **Esforço** | **S** |
| **Risco** | **Baixo** |
| **Prioridade** | **P0** |
| **Impacto** | Cobre a exigência de "arquivos excessivamente grandes". Em instância única, o `readFileSync` congela **todas** as requisições durante a leitura, incluindo healthcheck — risco de reciclagem por falso positivo. Corrige também o suporte a PDF, hoje quebrado sem que ninguém perceba. |

---

### M1-08 · Timeout, retry limitado e tratamento de erro no Gemini

**Status:** Concluída em 2026-08-13.

**Evidência de validação:** testes determinísticos confirmam timeout de 30 s por tentativa com cancelamento do cliente, no máximo 2 tentativas, backoff de 250 ms, retry de `429`, `5xx`, timeout e falhas de rede, sem retry para erros permanentes ou respostas inválidas. Respostas vazias, JSON malformado e estruturas mínimas incompatíveis são tratadas sem expor conteúdo sensível; extração e similarity permanecem funcionais e fora da transação. Suíte completa: 80/80; typecheck e build concluídos. O PostgreSQL Integration Gate de M1-05/M1-06 foi aprovado em 2026-08-13.

**Descrição**
Adicionar timeout explícito e `AbortSignal` às duas chamadas, retry com backoff e teto rígido apenas para erros transitórios (`429`, `5xx`), proteger o `JSON.parse` e converter falhas em `AppError` com status adequado.
*Itens de origem: 4.1*

| | |
|---|---|
| **Dependências** | nenhuma |
| **Esforço** | **M** |
| **Risco** | **Baixo** — localizado no provider |
| **Prioridade** | **P0** |
| **Impacto** | Atende as exigências de "chamadas sem timeout" e "retries descontrolados". Em instância única, uma chamada pendurada retém handler e conexão indefinidamente. `429`/`503` são comportamento normal de API de LLM — hoje cada um vira erro definitivo e motiva reenvio, que sem M1-06 duplica estoque. |

---

## PostgreSQL Integration Gate do Milestone 1

**Status:** Aprovado em 2026-08-13. **Milestone 1 validado e concluído.**

**Infraestrutura e isolamento:** PostgreSQL 16 Alpine efêmero via `docker-compose.test.yml`, exposto somente em `127.0.0.1:55432`, banco `docscan_integration_test`, credenciais locais exclusivas de teste e armazenamento em `tmpfs`. O runner define uma `TEST_DATABASE_URL` exclusiva, recusa execução direta sem essa variável ou sem `test` no nome do banco, copia a URL para `DATABASE_URL` somente no processo filho exigido pela configuração Prisma e sempre executa teardown com remoção de volumes. A `DATABASE_URL` normal não foi usada.

**Migrations e schema:** as sete migrations históricas foram aplicadas em ordem com `prisma migrate deploy` sobre banco vazio, incluindo `20260813120500_add_processed_invoice_idempotency`; `prisma validate` confirmou compatibilidade com o Prisma Client atual. A operação mínima real criou `ProcessedInvoice` e produto consultável pela chave composta `(stockId, code)`. Nenhuma migration existente foi alterada e `db push` não foi usado.

**Provas PostgreSQL:** rollback de lote com dois itens deixou zero produtos, zero identidades e zero auditorias de sucesso; retry com a mesma chave processou normalmente. Concorrência com quantidade inicial 10 e incrementos 7 e 11 terminou em 28. Concorrência idempotente da mesma chave teve uma operação vencedora e uma duplicata `409`, quantidade final 6, um produto, um `ProcessedInvoice` e uma auditoria de sucesso. Inserção direta duplicada foi rejeitada com `P2002`, e o repositório traduziu o mesmo conflito para `AppError` 409. Usuário não autorizado recebeu 403 antes da IA, sem produto, saldo ou identidade; somente a auditoria de acesso negado foi persistida.

**Repetibilidade e validação:** a suíte PostgreSQL passou duas vezes sobre bancos recriados do zero (1 arquivo, 6 testes, 6/6 em cada execução; uma execução adicional após ajuste de tipagem também passou 6/6). Suíte unitária completa: 18 arquivos, 80/80. Typecheck, build e `git diff --check`: aprovados. O projeto não possui script de lint declarado. Nenhum Gemini real foi chamado.

---

**Saída do Milestone 1:** validada. Processo não derrubável por requisição, isolamento entre empresas na escrita, saldo correto sob concorrência, reenvio seguro, entrada limitada e chamadas de IA com contorno de falha.

---

---

# Milestone 2 — Segurança

*Objetivo: fechar abuso de endpoint, vazamento em log e entrada não validada.*

---

### M2-01 · Rate limiting em `/login` e `/users` e `trust proxy`

**Status:** Concluída em 2026-08-13.

**Evidência de validação:** `POST /login` protegido por IP com 10 requisições a cada 15 minutos e `POST /users` com 5 requisições por hora, em `MemoryStore` independentes. Testes HTTP confirmam tráfego legítimo, bloqueio `429` previsível com `Retry-After`, não execução dos controllers após o limite, isolamento entre IPs e abertura de nova janela sem sleep real. `TRUST_PROXY_HOPS` é validado entre 0 e 10, tem default seguro 0 e passa a confiar no número exato de proxies configurado; headers encaminhados são ignorados quando a confiança está desabilitada. O limiter de upload permanece em 5/min por usuário e seu handler agora encaminha `AppError` via `next`. Testes específicos: 17/17; suíte completa: 88/88; typecheck, build e `git diff --check` aprovados. Requisito operacional: definir `TRUST_PROXY_HOPS=1` somente quando a API estiver atrás de exatamente um proxy reverso confiável.

**Descrição**
Aplicar o middleware de rate limit já existente aos endpoints não autenticados, com janela e limite próprios, e configurar `trust proxy` corretamente para que a chave por IP seja confiável. Trocar o `throw` do handler por `next(...)`.
*Itens de origem: 1.2, 3.4*

| | |
|---|---|
| **Dependências** | nenhuma |
| **Esforço** | **S** |
| **Risco** | **Baixo** |
| **Prioridade** | **P0** |
| **Impacto** | Fecha brute force e DoS assimétrico via argon2 — cada tentativa custa memória e CPU do servidor e nada do atacante. `trust proxy` deixa de ser opcional aqui: sem usuário autenticado, o IP é a única chave, e atrás de proxy todos os clientes compartilham o mesmo. Com instância única, o `MemoryStore` é adequado — revisitar só ao escalar. |

---

### M2-02 · Remover log de credencial e adotar logger estruturado

**Status:** Concluída em 2026-08-13.

**Evidência de validação:** removidos os 17 usos de `console.*` do código de produção, incluindo o log de login que expunha e-mail e hash Argon2 e os logs textuais de repositório/use cases. Logger interno estruturado em JSON fornece níveis `debug`, `info`, `warn` e `error`, timestamp, mensagem, request ID e contexto, com sink injetável e redaction recursiva centralizada para senha/hash, authorization, cookies, tokens/JWTs, API keys e secrets, sem nova dependência. Middleware gera UUID ou aceita `X-Request-Id` externo somente com formato seguro e até 64 caracteres, devolve o header em respostas normais, erros e `429`, e permite correlação no error handler e no cleanup do upload. Testes comportamentais confirmam ausência de senha/hash/e-mail nos logs de login, silêncio seguro no cadastro e Gemini, resposta sem detalhes internos e redaction aninhada. Testes focados: 42/42; suíte completa: 94/94; typecheck, build e `git diff --check` aprovados. Busca final: zero `console.*` em produção e nenhum call site do logger recebe body, headers, prompt, resposta Gemini ou credencial.

**Descrição**
Remover o `console.log` que imprime o objeto completo do usuário com hash de senha. Introduzir logger estruturado com níveis, `redact` de campos sensíveis e request ID para correlação, substituindo as ocorrências de `console.*` em código de produção.
*Itens de origem: 1.3, 10.3*

| | |
|---|---|
| **Dependências** | nenhuma |
| **Esforço** | **M** (a remoção do log crítico é **S** e pode ir isolada) |
| **Risco** | **Baixo** |
| **Prioridade** | **P0** |
| **Impacto** | A linha do hash de senha é risco imediato de conformidade e custa 15 minutos. O logger torna a proteção estrutural (via `redact`) em vez de disciplinar, e resolve a impossibilidade atual de diagnosticar incidente sob concorrência — sem correlação, as linhas de notas diferentes se intercalam. |

---

### M2-03 · Validação de entrada com schema declarativo

**Status:** Concluída em 2026-08-13.

**Evidência de validação:** `zod` aplicado antes dos controllers em login, cadastro de usuário, criação de empresa e query de produtos, além da validação do body multipart com limpeza do arquivo temporário em falha. Objetos HTTP rejeitam campos desconhecidos e retornam `400` no envelope existente sem refletir o payload; e-mail e nomes são normalizados, IDs externos seguem UUID e nenhuma rota atual possui `params`. Respostas DANFE e similarity agora passam por schemas declarativos: extras são descartados, números não sofrem coerção, chave de acesso exige 44 dígitos, confiança fica entre 0 e 1 e `issuedAt` é convertido de data ISO válida para `Date`. JSON vazio/malformado, timeout, retry e fallback seguro de similarity de M1-08 foram preservados. RED registrou 14 falhas comportamentais; testes focados: 55/55; suíte completa: 111/111; typecheck e build aprovados.

**Descrição**
Introduzir `zod` e aplicar em duas fronteiras: corpo das requisições HTTP (com normalização) e resposta do Gemini (corrigindo de passagem o tipo `issuedAt`, que hoje é declarado `Date` e nunca é `Date`).
*Itens de origem: 10.2, 4.3*

| | |
|---|---|
| **Dependências** | nenhuma |
| **Esforço** | **M** |
| **Risco** | **Baixo-médio** — passa a rejeitar entradas hoje aceitas (desejado, mas exige comunicar clientes) |
| **Prioridade** | **P1** |
| **Impacto** | Uma dependência cobre três lacunas. Hoje senha de um caractere é aceita, e-mail malformado é persistido, e erro de tipo vira `500` em vez de `400`. A normalização automática também alimenta M3-03. |

---

### M2-04 · Corrigir `companyId` vindo do cliente e isolar falhas de auditoria

**Status:** Concluída em 2026-08-13.

**Evidência de validação:** o upload de invoice agora aceita somente `stockId` e deriva `companyId` de `authorizedStock.companyId`; o schema estrito rejeita tenant enviado pelo cliente. Em `GET /products`, `companyId` continua aceito como filtro primário isolado, mas a combinação redundante `stockId + companyId` é rejeitada. Audits de sucesso de invoice e company passaram a best-effort pós-operação; o audit de `UNAUTHORIZED_ACCESS` permanece antes do `403`, mas sua falha não concede acesso nem altera o status. Falhas são registradas pelo logger estruturado com request ID, ação, entidade e nome do erro, sem payload ou mensagem interna. A transação da invoice continua contendo somente `ProcessedInvoice` e todos os upserts, preservando atomicidade e idempotência. RED: 6 falhas em 39 testes; testes focados: 59/59; suíte completa: 117/117; PostgreSQL efêmero: 7/7, incluindo commit principal apesar de audit failure e retry `409` sem novo incremento; typecheck e build aprovados.

**Descrição**
Derivar o `companyId` do audit log do estoque real em vez de aceitá-lo do corpo da requisição, e isolar a escrita de auditoria para que sua falha não derrube uma operação já persistida.
*Itens de origem: 1.5*

| | |
|---|---|
| **Dependências** | M1-04 |
| **Esforço** | **S** |
| **Risco** | **Baixo** |
| **Prioridade** | **P1** |
| **Impacto** | Hoje o atacante controla se sua própria tentativa de acesso indevido aparece na trilha — basta enviar um `companyId` inexistente para que a FK falhe e o log seja suprimido. Elimina também o `500` retornado após persistência bem-sucedida, que induz reenvio. |

---

### M2-05 · Limitar candidatos enviados ao modelo

**Status:** Concluída em 2026-08-13.

**Evidência de validação:** prefilter determinístico em memória aplicado entre o catálogo stock-scoped e `findSimilarProduct`, com teto centralizado de 15 candidatos conforme a recomendação de origem. A normalização usa lowercase, remoção de acentos, pontuação e whitespace consistente, preservando números e medidas; o ranking combina tokens exatos, prefixos e igualdade textual, com desempate estável por descrição normalizada, código e ID. Catálogos stock-scoped de até 15 itens continuam completos; acima disso, somente candidatos com sinal lexical são enviados e a ausência de sinal dispensa a chamada ao Gemini, sem fallback ilimitado. O prompt recebe apenas `id`, `code` e `description`, em JSON compacto. RED demonstrou 30/30 candidatos enviados e chamada com 20 itens irrelevantes; testes focados: 79/79; suíte completa: 125/125; typecheck e build aprovados.

**Descrição**
Pré-filtrar os produtos do estoque antes da chamada de similaridade — por código, por trigrama (`pg_trgm`) ou por recorte equivalente — enviando um conjunto reduzido de candidatos em vez do estoque inteiro.
*Itens de origem: 4.2 (parcial)*

| | |
|---|---|
| **Dependências** | M1-08 |
| **Esforço** | **M** |
| **Risco** | **Médio** — altera a qualidade do matching; validar com dados reais antes de reduzir demais |
| **Prioridade** | **P1** |
| **Impacto** | "Envio desnecessário de todos os produtos do estoque ao modelo" foi definido como proteção obrigatória pré-produção. O custo por nota cresce com o tamanho do estoque, ou seja, com o sucesso do produto. O pré-filtro é aditivo e reversível; a otimização de lote fica em M5-02. |

---

### M2-06 · Endurecer defesas contra prompt injection

**Status:** Concluída em 2026-08-13.

**Evidência de validação:** prompts de extração e similarity agora usam `systemInstruction` da versão instalada do SDK para regras confiáveis, enquanto documento, item e candidatos seguem em partes `user` delimitadas como dados não confiáveis. O output estruturado nativo foi preservado e continua validado por Zod; similarity reconcilia explicitamente o ID retornado com o conjunto enviado, degradando ID inventado para `null`. Dados do catálogo permanecem minimizados a `id`, `code` e `description`, com prefilter limitado a 15. RED: 2 falhas esperadas por ausência de `systemInstruction`; testes focados: 52/52; suíte completa: 128/128; typecheck, build e `git diff --check` aprovados.

**Descrição**
Reforçar a sanitização (hoje remove marcação HTML mas preserva texto imperativo) e delimitar explicitamente o conteúdo não confiável no prompt de similaridade.
*Itens de origem: 1.6*

| | |
|---|---|
| **Dependências** | M2-03 |
| **Esforço** | **S** |
| **Risco** | **Baixo** |
| **Prioridade** | **P2** |
| **Impacto** | Severidade limitada por quatro defesas já implementadas (schema forçado, limiar em código, reconciliação de ID, não-persistência) — o teto do ataque é induzir uma sugestão falsa a um humano. Após M3-02, o vetor persistente ganha alcance maior, o que justifica tratar antes daquele marco fechar. |

---

### M2-07 · CORS restrito e cabeçalhos de segurança

**Status:** Concluída em 2026-08-13.

**Evidência de validação:** `CORS_ALLOWED_ORIGINS` é parseada centralmente como allowlist de origins HTTP(S), com trim, remoção de vazios/duplicatas, default vazio e rejeição de wildcard, credenciais, paths e valores inválidos. CORS permite somente `GET`, `POST` e `OPTIONS`, aceita `Content-Type`, `Authorization` e `X-Request-Id`, expõe `X-Request-Id` e `Retry-After` e mantém credentials desabilitado; clientes sem `Origin` continuam aceitos. Helmet 8 foi inserido no pipeline com defaults seguros e CSP desabilitada deliberadamente porque a aplicação é uma API JSON sem HTML. RED: 8 falhas e uma suíte sem coleta pela ausência do middleware; testes focados HTTP/configuração: 42/42; suíte completa: 140/140; typecheck, build e `git diff --check` aprovados.

**Descrição**
Restringir a origem do CORS às origens conhecidas e adicionar `helmet`.
*Itens de origem: 1.8*

| | |
|---|---|
| **Dependências** | origem do frontend definida |
| **Esforço** | **S** |
| **Risco** | **Médio se a origem não estiver definida** — restringir errado quebra o cliente |
| **Prioridade** | **P2** |
| **Impacto** | Defesa em profundidade. Não é vulnerabilidade explorável no modelo atual (Bearer em header, sem cookies) — por isso não está em M1. |

---

**Saída do Milestone 2:** validada. Rate limits e identificação segura de IP, logging com redaction/request ID, validação declarativa das fronteiras, tenancy derivada, auditoria best-effort, minimização/hardening do Gemini e política HTTP restritiva foram concluídos. **Milestone 2 concluído em 2026-08-13.**

---

---

# Milestone 3 — Integridade de dados

*Objetivo: o dado persistido passa a refletir a intenção do domínio — custeio correto, ciclo de decisão fechado, trilha reconstruível.*

---

### M3-01 · Migrar custeio para média ponderada

**Status:** Concluída em 2026-08-13.

**Evidência de validação:** o upsert de produto passou a usar `INSERT ... ON CONFLICT DO UPDATE` parametrizado dentro da mesma transação de `ProcessedInvoice`, calculando no PostgreSQL `(quantidade atual × custo atual + quantidade recebida × custo recebido) / quantidade final`. `quantity` permanece `Decimal(12,4)`; `unitPrice` e `totalPrice`, `Decimal(12,2)`, são arredondados pelo PostgreSQL para duas casas e o total é derivado do saldo final. O gate real provou os casos 10×5 + 10×15 = 20×10 e 10×5 + 5×20 = 15×10, saldo zero com decimais, concorrência sobre produto existente (30, custo 11,67), criação concorrente (um produto, quantidade 15, custo 13,33), idempotência de custo, rollback e audit best-effort. RED PostgreSQL: 3 falhas por último custo; gate PostgreSQL executado duas vezes do zero: 12/12 em ambas; testes focados: 33/33; suíte completa: 140/140; typecheck, build e `git diff --check` aprovados. Nenhuma migration foi necessária.

**Descrição**
Substituir a aritmética atual do upsert pelo cálculo de média ponderada: novo custo unitário = (saldo × custo atual + quantidade recebida × custo recebido) ÷ quantidade total, com `totalPrice` derivado e consistente. Ajustar o teste que fixa o comportamento atual e migrar os dados existentes.
*Itens de origem: 6.1*

| | |
|---|---|
| **Dependências** | M1-05 |
| **Esforço** | **M** |
| **Risco** | **Médio** — altera valores persistidos; exige migração de dados e revisão do teste de upsert |
| **Prioridade** | **P0** |
| **Impacto** | A definição de média ponderada resolve a decisão de negócio que estava aberta. Hoje a linha do produto é aritmeticamente incoerente (`60 × 2,50 ≠ 125,00`) e o valor de inventário é irreproduzível. **Corrigir agora é barato; depois exige migrar volume acumulado.** |

---

### M3-02 · Persistir sugestões e fechar o ciclo de confirmação/rejeição

**Status:** Concluída em 2026-08-13.

**Evidência de validação:** `ProductSimilaritySuggestion` persiste `ProcessedInvoice`, `itemIndex`, estoque/produto sugerido, snapshot de código/descrição/quantidade/custo/unidade, confidence, reason e decisão humana em lifecycle fechado `PENDING → CONFIRMED|REJECTED`. Exact-code continua automático; similarity cria pending dentro da transação da invoice sem alterar estoque; no-match continua criando produto. Endpoints autenticados listam pending por estoque e recebem apenas suggestion ID com body vazio para confirmar/rejeitar. Confirmação aplica a primitive ponderada de M3-01; rejeição preserva o candidato e cadastra o snapshot como produto novo. Transição condicional `WHERE status = PENDING` e estoque/status na mesma transação impedem decisão/aplicação dupla. RED: casos de uso inexistentes; testes focados: 59/59; suíte completa: 150/150; PostgreSQL efêmero com 8 migrations: 20/20 em duas execuções finais, cobrindo pending, rollback, retry, owner/collaborator/outsider, weighted average, reject/new-product e corridas confirm/confirm e confirm/reject. Typecheck, build e `git diff --check` aprovados.

**Descrição**
Implementar o fluxo especificado: match determinístico por código continua atualizando automaticamente; match identificado pela IA passa a gerar **sugestão pendente persistida**, sem alterar estoque. Criar a entidade de sugestão (item da nota, produto candidato, confiança, estado, nota de origem), os endpoints de listagem, confirmação e rejeição, e a aplicação da entrada apenas após confirmação — com cadastro como novo produto no caso de rejeição.
*Itens de origem: 5.2, 5.3, 5.4*

| | |
|---|---|
| **Dependências** | M1-04, M1-05, M1-06 |
| **Esforço** | **L** |
| **Risco** | **Baixo** — funcionalidade nova e aditiva; não altera caminhos existentes |
| **Prioridade** | **P0** |
| **Impacto** | Completa o fluxo principal do produto. Hoje um item que gera sugestão **não tem como entrar no estoque por nenhum meio da API** — a IA identifica a duplicata e o sistema não a resolve. Preserva integralmente a regra de ouro (a IA sugere, o humano decide) e passa a registrar as decisões, o que alimenta M4-04 e M6-02. Inclui o ajuste de adicionar produtos recém-criados à base de comparação dentro da mesma nota (5.4), hoje invisíveis às comparações seguintes. |

---

### M3-03 · Normalização e validação de CNPJ

**Status:** Concluída em 2026-08-13.

**Evidência de validação:** primitive determinística única normaliza a apresentação oficial para 14 posições canônicas, preserva letras em uppercase e valida os dois DVs pelo módulo 11 oficial (valor ASCII menos 48). O fluxo aceita simultaneamente CNPJ numérico legado e alfanumérico 2026; HTTP, `CreateCompanyUseCase`, schema Gemini e `ReadInvoiceUseCase` usam a mesma regra, rejeitando DV/símbolos inválidos antes de consulta ou persistência. Os vetores independentes incluem `11.222.333/0001-81`, `04.252.011/0001-10` e o exemplo oficial `12.ABC.345/01DE-35`. RED: módulo ausente, máscara persistida, casing duplicável e DV inválido aceito; testes focados: 40/40 no primeiro GREEN e 96 casos de boundaries/regressão antes do ajuste final; suíte completa: 177/177; PostgreSQL Gate efêmero com 8 migrations: 20/20; typecheck, build e `git diff --check` aprovados. O campo `TEXT UNIQUE` já comporta a representação canônica numérica/alfanumérica, portanto nenhuma migration foi necessária.

**Descrição**
Normalizar para 14 posições canônicas na entrada, suportando CNPJ numérico legado e CNPJ alfanumérico, validar dígitos verificadores e migrar registros existentes quando necessário antes que a base cresça.
*Itens de origem: 2.2*

| | |
|---|---|
| **Dependências** | M2-03 |
| **Esforço** | **S** |
| **Risco** | **Baixo agora, alto depois** — o custo cresce com o volume da base |
| **Prioridade** | **P1** |
| **Impacto** | A constraint de unicidade não protege contra formatos diferentes do mesmo contribuinte: um frontend com input mascarado — o padrão no Brasil — cria tenants duplicados no primeiro cadastro real. Pré-requisito de qualquer integração fiscal futura. |

---

### M3-04 · Auditoria completa: `stockId`, descrição e estados

**Status:** Concluída em 2026-08-13.

**Evidência de validação:** `IAuditLog`, repository Prisma e dublê agora preservam `stockId`, `description`, `previousState` e `newState`, usando as colunas já existentes. Company criada referencia company/owner/estoque sem persistir CNPJ; invoice bem-sucedida registra escopo e contagens; cada entrada determinística gera evento `PRODUCT CREATE|UPDATE` pós-commit com somente `{ quantity, unitPrice, totalPrice }` antes/depois; tentativa negada registra stock/company apenas quando derivados do estoque persistido. Audit permanece best-effort fora de `$transaction`, com falha segura correlacionada pelo request ID no logger. RED: 7 falhas por campos descartados/ausentes; testes focados: 25/25; suíte completa: 178/178; PostgreSQL efêmero com 8 migrations: 21/21, incluindo estados JSONB reais, tenant/actor/target e commit/idempotência apesar de falha do audit. Typecheck aprovado; nenhuma migration necessária.

**Descrição**
Estender a interface do repositório de auditoria para gravar `stockId`, `description`, `previousState` e `newState` — colunas que já existem no schema e na migration e nunca são escritas.
*Itens de origem: 2.4*

| | |
|---|---|
| **Dependências** | M1-05 |
| **Esforço** | **S** |
| **Risco** | **Baixo** — aditivo |
| **Prioridade** | **P1** |
| **Impacto** | Melhor relação custo/benefício do relatório: as colunas já existem. Sem `previousState`, uma divergência de saldo é irreconstruível — que é exatamente o cenário de M1-05. Sem `stockId`, a detecção do acesso indevido de M1-04 fica cega. Habilita M5-01. |

---

### M3-05 · Alinhar propriedade do produto ao estoque e paginar a listagem

**Status:** Concluída em 2026-08-13.

**Evidência de validação:** `GET /products` agora exige `stockId`, autoriza owner ou collaborator com `StockPermission.canView` antes da query e lista exclusivamente pelo estoque, preservando `Product.userId` apenas como provenance inclusive quando `SetNull`. A paginação por cursor usa default 50, máximo 200, `createdAt DESC, id DESC`, `take limit + 1` e resposta `{ items, nextCursor }`; cursor inexistente ou de outro estoque retorna 400 sem expor dados. O teste que exigia esconder produto de outro criador foi reescrito para provar a visibilidade compartilhada. RED: 8 falhas esperadas; testes focados: 22/22; suíte completa: 182/182; PostgreSQL efêmero com 8 migrations: 22/22 em duas execuções, cobrindo múltiplos criadores, creator removido, owner/collaborator/outsider, páginas sem duplicação/perda e cursor cross-stock. Typecheck, build e `git diff --check` aprovados. Nenhuma migration ou índice novo foi necessário.

**Descrição**
Trocar o filtro por criador na leitura por autorização de acesso ao estoque, e introduzir paginação por cursor no mesmo movimento. Reescrever o teste que codifica o comportamento atual.
*Itens de origem: 7.2, 8.2*

| | |
|---|---|
| **Dependências** | M1-04 |
| **Esforço** | **M** |
| **Risco** | **Médio** — muda o que cada usuário enxerga; quebra um teste existente por desenho |
| **Prioridade** | **P1** |
| **Impacto** | Hoje dois colaboradores da mesma empresa veem, cada um, metade do estoque, e produtos com criador removido (`SetNull`) desaparecem de toda listagem enquanto continuam somando saldo. **Paginação é obrigatória no mesmo commit** — remover o filtro por usuário aumenta imediatamente o volume retornado. |

---

### M3-06 · Validação de coerência do DANFE

**Status:** Concluída em 2026-08-13.

**Evidência de validação:** uma função pura baseada em `Prisma.Decimal` valida cada linha por `quantity × unitPrice ≈ totalPrice`, com tolerância `max(R$ 0,02, 1%)`, e rejeita quando a soma dos `totalPrice` excede `totalValue` em mais de R$ 0,02. A comparação global permanece assimétrica conforme o finding 4.4, permitindo total maior por frete, seguro e IPI. A validação ocorre após schema/CNPJ/positividade e antes de catálogo, exact match, similarity ou persistência; inconsistência retorna 422 genérico, sem consumir idempotência ou gerar audit de sucesso. RED: helper ausente e invoice incoerente preparada para persistência; testes focados: 85/85; suíte completa: 199/199; PostgreSQL efêmero com 8 migrations: 23/23 em duas execuções finais, provando ausência de `ProcessedInvoice`, alteração de estoque, produto, suggestion e audit na falha, seguida de retry coerente bem-sucedido. Typecheck, build e `git diff --check` aprovados. Nenhuma migration ou dependência foi necessária.

**Descrição**
Verificar, após a extração, se a soma dos itens é compatível com o total declarado da nota, rejeitando ou sinalizando divergências acima da tolerância.
*Itens de origem: 4.4*

| | |
|---|---|
| **Dependências** | M2-03 |
| **Esforço** | **S** |
| **Risco** | **Baixo-médio** — tolerância mal calibrada rejeita nota legítima |
| **Prioridade** | **P2** |
| **Impacto** | Detecta a classe de erro de OCR mais provável e mais cara (dígito trocado em quantidade ou valor) antes de contaminar o estoque. Todos os dados já são extraídos — a verificação custa uma soma em memória. |

---

### M3-07 · Não sobrescrever `description` no upsert

**Status:** Concluída em 2026-08-13.

**Evidência de validação:** a primitive SQL ponderada continua usando a description recebida no `INSERT`, mas não a inclui mais no `DO UPDATE` do conflito `(stockId, code)`. Assim, exact-code e confirmação de similarity preservam a descrição curada do produto existente; no-match e rejeição continuam criando produto com a descrição recebida/snapshot. Quantity, custo médio e total permanecem no mesmo upsert atômico. RED: o teste estrutural encontrou `"description" = EXCLUDED."description"`; testes focados: 64/64; suíte completa: 200/200; PostgreSQL efêmero com 8 migrations: 24/24 em duas execuções, cobrindo entradas sequenciais, confirm/reject, concorrência sobre existente e corrida de criação. Typecheck, build, Prisma validate e `git diff --check` aprovados. Nenhuma migration ou dependência foi necessária.

**Descrição**
Preservar a descrição cadastrada ao atualizar saldo por código, em vez de substituí-la pelo texto extraído da nota mais recente.
*Itens de origem: 6.2*

| | |
|---|---|
| **Dependências** | M1-05 |
| **Esforço** | **S** |
| **Risco** | **Baixo** |
| **Prioridade** | **P2** |
| **Impacto** | Impede que produtos mudem de nome sozinhos a cada nota e que uma extração ruim degrade permanentemente a base usada pelo matching. |

---

### M3-08 · `findUnique` na chave composta e tradução de erros do Prisma

**Status:** Concluída em 2026-08-13.

**Evidência de validação:** `findByCode` passou a usar `findUnique` com `stockId_code`; o upsert ponderado já permanecia corretamente baseado em `ON CONFLICT (stockId, code)`. Um reconhecedor mínimo centraliza somente os códigos `P2002`/`P2003`, enquanto Product, Company, User e Stock traduzem cada constraint com contexto de domínio: conflitos de unicidade e exclusão referenciada retornam `409`, e referências inválidas em criação/alteração retornam `400`, sem expor metadata Prisma. A duplicidade de `ProcessedInvoice` preserva o `409` e o rollback transacional de M1-06. RED: 9 falhas nos lookups/traduções ausentes; testes focados: 23/23; suíte completa: 209/209; PostgreSQL efêmero com 8 migrations: 25/25 em duas execuções, comprovando códigos iguais em stocks distintos, lookup correto, corrida P2002 com uma única linha, P2003 real com integridade preservada e regressão da idempotência. Typecheck, build, Prisma validate e `git diff --check` aprovados. Nenhuma migration ou dependência foi necessária.

**Descrição**
Usar a chave composta no lookup por código e mapear `P2002`/`P2003` para `AppError` com status adequado.
*Itens de origem: 2.3*

| | |
|---|---|
| **Dependências** | M1-05 |
| **Esforço** | **S** |
| **Risco** | **Baixo** |
| **Prioridade** | **P2** |
| **Impacto** | Parcialmente absorvido por M1-05, que já passa a usar a chave composta no upsert. O que resta é a tradução de erro — hoje violação de constraint vira `500` genérico. |

---

**Saída do Milestone 3:** validada. Custo médio ponderado concorrente, ciclo humano de similarity, CNPJ numérico/alfanumérico, auditoria de domínio, ownership/paginação, coerência do DANFE, preservação de description e tradução de constraints Prisma foram concluídos. **Milestone 3 concluído em 2026-08-13.**

---

---

# Milestone 4 — Operação

*Objetivo: o sistema pode ser implantado, observado e alterado com rede de segurança.*

---

### M4-01 · Prontidão operacional do processo

**Descrição**
Graceful shutdown (drenar requisições, encerrar o pool de M1-02), endpoint de healthcheck que verifique dependências reais, handlers de `unhandledRejection`/`uncaughtException` com log antes de encerrar, e timeout de requisição.
*Itens de origem: seção 3 e 7 (prontidão operacional)*

| | |
|---|---|
| **Dependências** | M1-01, M1-02 |
| **Esforço** | **M** |
| **Risco** | **Baixo** |
| **Prioridade** | **P0** |
| **Impacto** | Em instância única, todo deploy hoje interrompe requisições em voo — e antes de M1-05 isso deixava notas parcialmente aplicadas. Os handlers de processo são a rede de segurança de última instância para a classe de erro de M1-01. O healthcheck é pré-requisito de qualquer orquestração. |

---

### M4-02 · Testes de rota e de middleware de autenticação

**Descrição**
Cobrir as rotas via HTTP com use cases mockados, e o middleware de autenticação em seus cenários de falha (token ausente, malformado, expirado, assinatura inválida, usuário removido após emissão). Inclui converter o middleware em factory que recebe dependências — hoje ele constrói as próprias, o que o torna intestável e é o único ponto do sistema fora do padrão de injeção.
*Itens de origem: 9.2 (parcial), 8.4*

| | |
|---|---|
| **Dependências** | M1-01, M1-04 |
| **Esforço** | **L** |
| **Risco** | **Nulo** — aditivo (a refatoração do middleware é **Baixo**) |
| **Prioridade** | **P0** |
| **Impacto** | Um único teste de rota teria capturado o problema mais grave do relatório. A camada mais bem escrita é a única testada; os três problemas críticos vivem nas camadas sem cobertura. Sem isso, as correções de M1 não têm regressão. |

---

### M4-03 · Testes de integração com Postgres real

**Descrição**
Suíte contra banco real cobrindo o que os dublês não representam: constraints de unicidade, rollback de transação no meio do lote, incremento atômico sob concorrência, comportamento de FK inválida e idempotência por chave de acesso.
*Itens de origem: 9.2 (complemento)*

| | |
|---|---|
| **Dependências** | M1-05, M1-06 |
| **Esforço** | **L** |
| **Risco** | **Nulo** — aditivo |
| **Prioridade** | **P1** |
| **Impacto** | Idealmente executado **junto** com M1-05 e M1-06, servindo de validação para eles em vez de vir depois. Hoje todos os testes de upsert passam porque o dublê não tem a constraint composta que o banco tem. |

---

### M4-04 · Observabilidade do pipeline de IA

**Descrição**
Instrumentar latência, tokens, custo, taxa de falha, distribuição de confiança e taxa de aceitação/rejeição das sugestões de M3-02.
*Itens de origem: 4.5*

| | |
|---|---|
| **Dependências** | M2-02, M3-02 |
| **Esforço** | **M** |
| **Risco** | **Baixo** |
| **Prioridade** | **P1** |
| **Impacto** | Atende a exigência de controle de custo. Hoje não há como responder se o limiar está calibrado, quanto custa uma nota, nem detectar degradação após atualização do modelo. É o dado que M6-02 e M5-02 exigem para não serem decisão às cegas. |

---

### M4-05 · Pipeline de CI e artefatos de implantação

**Descrição**
CI executando `tsc --noEmit`, a suíte de testes e validação do schema. `.env.example` documentando as variáveis de M1-03. Build de produção verificado **com apenas dependências de produção instaladas**.
*Itens de origem: prontidão operacional*

| | |
|---|---|
| **Dependências** | M1-03, M4-02 |
| **Esforço** | **M** |
| **Risco** | **Baixo** |
| **Prioridade** | **P1** |
| **Impacto** | O build com `--omit=dev` no CI é o que impede que a classe de defeito de M1-03 volte a passar despercebida — é a verificação automatizada do requisito de runtime. |

---

### M4-06 · Corrigir o teste que não assere nada e o dublê defeituoso

**Descrição**
Reescrever o teste de filtro por empresa com asserção real e corrigir o dublê in-memory, que hoje ignora o parâmetro que dá nome ao teste.
*Itens de origem: 9.1*

| | |
|---|---|
| **Dependências** | M3-05 |
| **Esforço** | **S** |
| **Risco** | **Nulo** |
| **Prioridade** | **P2** |
| **Impacto** | Cobertura declarada que não existe é pior que ausência de cobertura: quebrar o filtro por empresa no repositório real não faz nenhum teste falhar. |

---

### M4-07 · Reavaliar `engineType = "binary"`

**Descrição**
Testar a aplicação com o valor padrão do Prisma no ambiente-alvo, verificando se o problema de compatibilidade original ainda se manifesta. Manter o valor atual se reproduzir; documentar a razão de qualquer que seja a decisão.
*Itens de origem: 2.5*

| | |
|---|---|
| **Dependências** | M4-05 |
| **Esforço** | **S** |
| **Risco** | **Baixo** — reversível; validar em ambiente equivalente ao de produção |
| **Prioridade** | **P2** |
| **Impacto** | O valor fez parte de um pacote de correções de compatibilidade e não se sabe se ainda é necessário. Se não for, o padrão reduz consumo de memória e latência de cold start. **Se for, o valor precisa de comentário no schema** — configuração sem motivo registrado é convite a remoção equivocada no futuro. |

---

**Saída do Milestone 4:** portão de produção fechado. O sistema pode ser implantado, reiniciado sem perda, observado e alterado com regressão.

---

---

# Milestone 5 — Performance

*Pós-lançamento. Prioridade real orientada por M4-04.*

---

### M5-01 · Índices e política de retenção da auditoria

**Descrição**
Criar índices compostos `(fk, createdAt)` nas consultas reais de auditoria, produto e empresa, e definir retenção/particionamento do `AuditLog`.
*Itens de origem: 8.3*

| | |
|---|---|
| **Dependências** | M3-04 |
| **Esforço** | **M** |
| **Risco** | **Baixo** — criar com `CONCURRENTLY` se houver volume |
| **Prioridade** | **P1** |
| **Impacto** | A tabela que mais cresce é a menos indexada, e Postgres não indexa FK automaticamente. Não é sentido hoje; degrada progressivamente ao longo de meses. A decisão de retenção é mais barata antes do volume acumular. |

---

### M5-02 · Otimizar a chamada de similaridade

**Descrição**
Consolidar as N chamadas por nota em chamada única em lote, sobre os candidatos já reduzidos por M2-05.
*Itens de origem: 4.2 (restante)*

| | |
|---|---|
| **Dependências** | M2-05, M4-04 |
| **Esforço** | **M** |
| **Risco** | **Médio** — altera a qualidade do matching |
| **Prioridade** | **P2** |
| **Impacto** | Com volume de MVP, o ganho é secundário — por isso está aqui e não em M2. Só executar com os dados de M4-04 em mãos, para poder comparar qualidade antes e depois em vez de assumir equivalência. |

---

---

# Milestone 6 — Refatorações

*Higiene e consistência. Sem urgência; executar em janelas de folga.*

---

### M6-01 · Unificar convenções de erro e envelope de resposta

**Descrição**
Migrar os dois endpoints que usam `Error` cru com comparação de string no controller para `AppError` com handler global, e padronizar o formato de sucesso e de erro.
*Itens de origem: 10.1*

| | |
|---|---|
| **Dependências** | **M1-01 obrigatoriamente concluído** |
| **Esforço** | **M** |
| **Risco** | **Médio** — muda formato de resposta; exige coordenar com clientes |
| **Prioridade** | **P2** |
| **Impacto** | Hoje o status HTTP depende de comparação exata de texto entre camadas: traduzir uma mensagem para português converte `401` em `500` sem erro de compilação e sem teste falhando. **A dependência de M1-01 é rígida** — o try/catch atual é a única coisa que impede essas duas rotas de derrubar o processo. |

---

### M6-02 · Limiar de confiança configurável e bandas de decisão

**Descrição**
Extrair o limiar duplicado (hoje escrito no prompt e no código) para constante única e configurável.
*Itens de origem: 5.1*

| | |
|---|---|
| **Dependências** | M4-04 |
| **Esforço** | **S** |
| **Risco** | **Baixo** |
| **Prioridade** | **P2** |
| **Impacto** | Elimina o risco de os dois valores divergirem numa alteração futura. **Não alterar o valor** antes dos dados de M4-04 — trocar um número arbitrário por outro não é melhoria. |

---

### M6-03 · Ajustar o contrato do provider de armazenamento

**Descrição**
Fazer o storage entregar bytes e o provider de IA receber conteúdo e mimetype em vez de caminho, removendo o método declarado e nunca chamado.
*Itens de origem: 7.3*

| | |
|---|---|
| **Dependências** | M1-07 |
| **Esforço** | **S** |
| **Risco** | **Baixo** |
| **Prioridade** | **P3** |
| **Impacto** | Se executado junto com M1-07 o custo marginal é quase nulo. Remove o acoplamento oculto a disco local: hoje trocar de armazenamento exige alterar o provider de IA, não o de storage — a abstração não isola o que aparenta isolar. |

---

### M6-04 · Corrigir tipagem de `req.user` e substituir asserções por mappers

**Descrição**
Tornar `req.user` opcional no tipo (refletindo a realidade das rotas não autenticadas) e trocar os `as` dos repositórios por mappers explícitos, seguindo o padrão já estabelecido para produto.
*Itens de origem: 10.4*

| | |
|---|---|
| **Dependências** | M4-02 |
| **Esforço** | **S** |
| **Risco** | **Baixo** |
| **Prioridade** | **P3** |
| **Impacto** | A tipagem atual desliga a proteção do `strict` no ponto de segurança mais sensível: acessar `req.user.id` sem verificação compila e falha em runtime, virando `500` em vez de `401`. Os `as` silenciariam uma divergência de tipo como a que motivou a criação do mapper de produto. |

---

### M6-05 · Dublê de usuário compartilhado

**Descrição**
Criar repositório in-memory de usuário único, substituindo as duas implementações divergentes declaradas dentro dos specs.
*Itens de origem: 9.3*

| | |
|---|---|
| **Dependências** | M4-02 |
| **Esforço** | **S** |
| **Risco** | **Nulo** |
| **Prioridade** | **P3** |
| **Impacto** | Remove duplicação e habilita cenários multiusuário, hoje impossíveis por causa dos IDs fixos. |

---

### M6-06 · Reconciliar documentação e limpar resíduos

**Descrição**
Atualizar o README para descrever a arquitetura real, remover diretórios vazios, padronizar o idioma das mensagens de usuário em português e registrar as decisões arquiteturais deliberadas (ausência de container de DI, ausência de camada de entidades, não-persistência de match incerto).
*Itens de origem: 7.4, 10.4*

| | |
|---|---|
| **Dependências** | M3-02 |
| **Esforço** | **S** |
| **Risco** | **Nulo** |
| **Prioridade** | **P3** |
| **Impacto** | O README descreve entidades e mocks que não existem e um formato de ingestão que não é o real — documentação que descreve um sistema inexistente induz decisão errada. As boas decisões arquiteturais hoje existem apenas tacitamente e serão desfeitas por quem não souber que foram deliberadas. |

---

---

# Caminho crítico e dependências rígidas

```
M1-02 (Prisma único) ──► M1-05 (transação + atômico) ──► M1-06 (idempotência) ──► M3-02 (sugestões)
                                    │                                                    ▲
                                    └──► M3-01 (média ponderada)                         │
                                                                                         │
M1-04 (autorização) ─────► M3-05 (propriedade + paginação)                               │
        │                                                                                │
        └──► M2-04 (auditoria confiável)                                                 │
                                                                                         │
M1-01 (rotas) ──► M4-01 (operação) ──► M6-01 (convenções de erro)                        │
        │                                                                                │
        └──► M4-02 (testes de rota)                                                      │
                                                                                         │
M1-08 (timeout/retry) ──► M2-05 (pré-filtro) ──► M5-02 (lote)                            │
                                    │                                                    │
M2-02 (logger) ──────────► M4-04 (observabilidade de IA) ◄────────────────────────────────┘
                                    │
                                    └──► M6-02 (limiar configurável)
```

**Ordens que não podem ser invertidas:**

| Restrição | Motivo |
|---|---|
| M1-02 antes de M1-05 | Não há transação entre repositórios com clientes Prisma distintos |
| M1-01 antes de M6-01 | O try/catch atual é a única proteção contra a queda do processo naquelas rotas |
| M1-04 antes de M3-05 | Remover o filtro por criador sem autorização no lugar abre leitura cross-tenant |
| M1-06 antes de M3-02 | Sugestão confirmada duas vezes duplica entrada sem idempotência |
| M4-03 **junto com** M1-05/M1-06 | Testar depois é validar uma refatoração de risco alto sem rede |
| M4-04 antes de M6-02 e M5-02 | Alterar limiar ou estratégia de matching sem dado é troca de arbitrário por arbitrário |

# Esforço agregado

| Milestone | Tarefas | S / M / L | Estimativa |
|---|---|---|---|
| 1 — Bloqueadores | 8 | 4 / 2 / 2 | 8–12 dias |
| 2 — Segurança | 7 | 4 / 3 / 0 | 5–8 dias |
| 3 — Integridade | 8 | 4 / 3 / 1 | 8–12 dias |
| 4 — Operação | 7 | 2 / 3 / 2 | 8–12 dias |
| **Portão de produção (M1–M4)** | **30** | | **29–44 dias úteis** |
| 5 — Performance | 2 | 0 / 2 / 0 | 3–5 dias |
| 6 — Refatorações | 6 | 5 / 1 / 0 | 4–6 dias |

Três tarefas de M2 e M3 (M2-03, M3-03, M3-06) podem correr em paralelo com M1 por não terem dependências dele — o que comprime o portão para perto de **6 semanas** com uma pessoa, ou **3–4 semanas** com duas trabalhando em trilhas separadas (uma em integridade/concorrência, outra em segurança/operação).
