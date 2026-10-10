# Especificação — demonstração de portfólio com IA real

Data: 2026-10-10. Escopo aprovado: especificar e implementar com TDD.

## Objetivo e precedência

O objetivo atual é demonstrar a construção de um backend complexo com IA, com um
fluxo pequeno que um visitante possa experimentar. Esta decisão substitui, para
a demonstração, os tetos diários obrigatórios de D8 e os gates de lançamento
comercial do roadmap anterior. O histórico permanece preservado. Não há promessa
de capacidade reservada no Free Tier: a disponibilidade continua pertencendo ao
provedor. Não haverá resposta simulada apresentada como resultado de IA real.

## DEMO-01 — desativação configurável dos tetos

- Nova variável `GEMINI_QUOTA_ENFORCEMENT_ENABLED`, booleana estrita, default
  `false`. Ausência ou valor vazio usa o default; apenas `true`/`false` são aceitos.
- `false`: reservas globais e individuais continuam sendo gravadas atomicamente,
  mesmo acima de 18/5; nenhum desses tetos recusa uma chamada.
- `true`: comportamento anterior preservado, inclusive rollback das duas reservas
  se qualquer teto for ultrapassado e proteção sob concorrência.
- Os valores antigos continuam configuráveis e validados, mas só são aplicados
  com enforcement ligado. Não representam limites atuais garantidos do Google.
- `GEMINI_ENABLED=false` continua recusando IA independentemente do enforcement.
- Autorização, convites, rate limits HTTP, tamanho/tipo de upload, limite de itens,
  validação, transações e idempotência continuam ativos.
- Falha na reserva do ledger continua recusando a chamada: desligar o teto não
  transforma a contabilização em best-effort. Falha na reconciliação é registrada
  e mantém a reserva residual para diagnóstico, como no contrato existente.
- Sem migration, exclusão de histórico ou alteração de configuração hospedada.

## DEMO-02 — identidade da reserva e virada do dia

- `reserveAttempt` retorna um contexto de reserva contendo usuário e instante
  original; `generateContent` mantém esse contexto local a cada tentativa.
- `reconcileAttempt` recebe esse contexto. Nunca consulta o relógio para escolher
  o período a reconciliar. Cada retry obtém sua própria reserva.
- Chamadas concorrentes do mesmo usuário podem terminar fora de ordem: não usar
  mapa mutável por usuário nem um campo de "última reserva" no singleton.
- Sucesso contabiliza requisição e uso informado; falha contabiliza a tentativa
  sem inventar tokens. Recusa antes da chamada não reconcilia uma reserva inexistente.
- Testar duas reservas ao redor da meia-noite com conclusão em ordem inversa,
  além da reconciliação real das respectivas linhas em PostgreSQL.

## DEMO-03 — recusa do provedor

- HTTP 429 do Gemini vira erro de domínio próprio, HTTP 503 para o consumidor da
  API (indisponibilidade da dependência compartilhada).
- Mensagem: "O serviço de IA atingiu um limite temporário. Nenhuma alteração desta
  nota foi aplicada ao estoque. Tente novamente mais tarde."
- Não expor mensagem bruta do SDK, segredos ou stack; não prometer horário de
  recuperação nem emitir `Retry-After` calculado pela meia-noite local.
- Não repetir automaticamente 429. Preservar retries existentes de falhas
  transitórias e timeout; o limite do provedor é observado, não contornado.
- Telemetria distingue `provider_rate_limit` de outras falhas do provedor.
- A classificação atravessa extração e similaridade. Similaridade continua com
  `unavailable`, nunca `no_match`. O caso de uso propaga o erro apropriado.
- Recusa em qualquer item aborta antes da transação: nenhum produto, sugestão ou
  registro de nota é persistido; arquivo temporário é removido; reenvio é permitido.

## DEMO-04 — material reproduzível de demonstração

- Documentos sintéticos, explicitamente sem valor fiscal, em PDF aceito pelo upload.
- Cenário inicial mínimo: um documento de um item em estoque vazio, uma operação
  de extração esperada, sem similaridade. É o caminho de menor consumo.
- Cenário ampliado: documento inicial cria catálogo; documento seguinte combina
  código exato, produto novo sem equivalência e item similar para revisão. O
  pré-filtro atual oferece todo catálogo com até 15 produtos: portanto o exemplo
  ampliado usa três operações de IA (extração + duas similaridades), mesmo que
  o produto novo não compartilhe tokens lexicais com o catálogo.
- Arquivos e dados esperados versionados; instruções usam API real para cadastro,
  login, empresa, descoberta de estoque, uploads e decisão de sugestão. Sem seed
  privilegiado no banco de produção e sem modificação automática de dados externos.
- Fornecer geração de novas chaves sintéticas para repetição sem remover a
  idempotência; reenviar a mesma chave continua sendo duplicata.
- A resposta de similaridade real é probabilística. Documentar o resultado
  esperado e conferir o resultado obtido, sem fabricar uma sugestão se não vier.
- Registrar contagem esperada versus observada: testes com SDK substituído provam
  o fluxo; só execução explicitamente identificada com Gemini real prova OCR e
  qualidade do matching. Não alegar validação real a partir de mocks.

## DEMO-05 — documentação e entrega

- README e decisões passam a apontar esta especificação e o guia da demonstração
  como escopo atual; roadmap comercial fica identificado como histórico/futuro.
- `.env.example` documenta enforcement, kill switch e limites inativos.
- Retenção, reconciliação e interpretação de cotas documentam o modo sem tetos.
- Preparação comercial (backup/restore, recuperação de conta, limites comerciais,
  dimensionamento e validação operacional) fica registrada como evolução futura.

## DEMO-06 — compatibilidade do schema com Gemini real

Achado em 2026-10-10 durante a verificação real: `gemini-2.5-flash` respondeu HTTP
400 `INVALID_ARGUMENT`, informando que o schema gerava restrição com estados
demais. O schema atual envia `products.maxItems=100` para geração estruturada.

- Remover o `maxItems` do schema enviado ao provedor; preservar `DANFE_MAX_ITEMS`
  na validação Zod da resposta, antes de matching ou persistência.
- Não truncar silenciosamente a extração nem aceitar nota parcialmente extraída.
- Teste de contrato comprova ausência de `maxItems` no request e os testes de
  excesso de itens continuam exigindo 422. Confirmar aceitação com Gemini real.
- O teto passa a proteger processamento e persistência, sem limitar previamente
  o tamanho da saída gerada pelo provedor. Essa limitação deve constar do README.

## TDD e critérios de aceite

1. Escrever e executar testes RED para flag/default/validação, ultrapassagem de
   ambos os tetos, reservas atravessando meia-noite, 429 e fluxo demonstrativo.
2. Implementar o mínimo e executar novamente os testes específicos (GREEN).
3. Cobrir com PostgreSQL real os contadores sem tetos, concorrência com enforcement
   ligado e reconciliação no período original. Banco efêmero isolado, nunca `.env`.
4. Rodar suíte completa, typecheck, lint, build, Prisma validate e importação do
   artefato de produção. Regenerar `.js`, `.d.ts` e mapas versionados.
5. Conferir consistência de build por segunda compilação sem novas diferenças;
   `verify:artifacts` exige checkout commitado limpo e não é usado para justificar
   commit automático durante esta implementação.
6. Renderizar e inspecionar os PDFs; registrar resultados e limitações abaixo.

## Resultado da implementação

Implementada em 2026-10-10, sem migration e sem alteração do ambiente hospedado.

| Ciclo | RED observado | GREEN |
|---|---|---|
| DEMO-01 | 2 falhas de configuração; PostgreSQL recusou duas reservas acima do teto mesmo com flag desligada | Configuração passou; 71 testes PostgreSQL passaram, incluindo concorrência, consumo e reativação dos tetos |
| DEMO-02 | Reconciliação usava dia de término; provider passava usuário em vez de contexto por tentativa | 22 testes de guard/provider passaram; teste adicional em PostgreSQL confirmou ambos os dias sem reservas residuais |
| DEMO-03 | 3 falhas: mensagem genérica, categoria genérica e perda da mensagem no matching | 15 testes específicos passaram; recusa no segundo item não persiste, limpa temporário e permite reenvio |
| DEMO-04 | Gerador inexistente e 2 cenários de integração sem fixtures | 2 testes Python passaram; ambos os caminhos de decisão passaram com SDK substituído e banco real |
| DEMO-06 | Request continha `maxItems=100`, reproduzindo o contrato recusado pela API real | 31 testes de provider passaram; validação local de N/N+1 preservada; chamada real aceita |

Validação final: **481 testes em 60 arquivos**, **74 testes de integração em 5
arquivos** contra PostgreSQL 16 efêmero com as 13 migrations aplicadas do zero,
e **2 testes Python** do gerador. Typecheck, lint, build, Prisma validate e
`verify:production` passaram. CI ganhou job para os testes dos documentos.

Os PDFs foram renderizados e inspecionados visualmente, sem cortes ou sobreposição.
Poppler não estava disponível; a renderização local usou PyMuPDF. Dependências
Python de geração foram instaladas em ambiente virtual dentro de `tmp/`;
não são dependências do backend nem pré-requisito para usar os PDFs prontos.

Verificação real: API HTTP local + PostgreSQL descartável + Gemini real concluíram
cadastro, login, empresa, discovery, dois uploads, confirmação e leitura do estoque.
**4 chamadas, 4.020 tokens, 0 reservas pendentes; 15 canetas e 1 caderno no final.**
Detalhes e tentativas diagnósticas anteriores estão no guia. Rejeição e falhas
foram comprovadas automaticamente; não são apresentadas como ensaio real de IA.

Build e artefatos foram regenerados. Não houve commit, push ou deploy nesta entrega.
O guard `verify:artifacts` exige checkout limpo e permanece como gate de CI após
o commit; a consistência local é verificada comparando hashes antes/depois de uma
segunda compilação. A disponibilidade do Free Tier continua externa ao projeto.
