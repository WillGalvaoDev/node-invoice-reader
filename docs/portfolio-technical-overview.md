# DocScan — visão técnica para portfólio

Demonstração de um backend com IA em que **a IA nunca é fonte de verdade**: ela extrai dados e sugere similaridade; tudo que altera estoque passa por regras determinísticas, transação e, quando muda a identidade de um produto, por decisão humana. Dados da demonstração são sintéticos e sem valor fiscal.

## Fluxo

```
PDF/imagem → upload validado → extração (Gemini) → validação (schema + coerência) →
matching determinístico por código/fornecedor/unidade → pré-filtro léxico → similaridade (Gemini)
→ transação única (produtos, sugestões, chave da nota) → revisão humana → auditoria/telemetria
```

## Onde a IA atua (e onde não)

| Etapa | Papel da IA | Controle determinístico |
|---|---|---|
| Extração do DANFE | Lê o documento e devolve JSON | Schema Zod, tipos, limite de itens (100), CNPJ com dígitos verificadores, chave de 44 dígitos, soma dos itens × total (tolerância definida) |
| Similaridade | Aponta um candidato **da lista oferecida** | ID fora da lista é recusado; resultado tem três estados (`match`, `no_match`, `unavailable`); indisponibilidade nunca vira "produto novo" |
| Decisão sobre identidade | Nenhum | Sugestão fica `PENDING` até `confirm`/`reject` humano |

O conteúdo do documento é tratado como **dado não confiável** (instruções incluídas no PDF não alteram o prompt de sistema), e respostas do modelo nunca são confiadas sem validação.

## Integridade e concorrência

- **Transação única** por nota: produtos, sugestões e `ProcessedInvoice` (chave de acesso única → idempotência, `409` em duplicata).
- **Acúmulo seguro**: código existente só acumula com mesmo fornecedor e mesma unidade; conflito aborta a nota com `422`, sem escrita. A regra é revalidada **dentro** do `INSERT … ON CONFLICT … WHERE`, então a corrida entre duas notas não mistura origens.
- **Decisões atômicas**: `PENDING → CONFIRMED|REJECTED` condicional; decisão dupla/simultânea aplica uma vez.
- **Contas e estoques isolados**: autorização derivada do recurso (nunca do corpo); recurso de outra conta responde como inexistente.

## Controles de custo e disponibilidade

- Ledger obrigatório (reserva → reconciliação) mede toda tentativa; **tetos internos desligados por padrão** na demonstração (`GEMINI_QUOTA_ENFORCEMENT_ENABLED=false`), kill switch independente (`GEMINI_ENABLED`).
- 429 do provedor é observado, não contornado: erro específico (`503`), sem retry automático, nota inteira não aplicada, reenvio permitido.
- Disponibilidade depende do provedor: **não há capacidade reservada**.

## Observabilidade

Evento por chamada de IA (operação, tokens, latência, categoria de falha, correlação) sem conteúdo do documento; auditoria de entradas de estoque e decisões; `GET /version` com o SHA da release; consultas e reconciliação em [telemetry-runbook.md](telemetry-runbook.md).

## O que é demonstração e o que não é

Feito e testado localmente: tudo acima, sessões de demonstração por visitante, interface web, E2E de navegador com Gemini determinístico. **Ainda não demonstrado**: execução hospedada com Gemini real nesta release (ver [evidência DP-05](evidence/DP-05.md)). Fora de escopo: faturamento, SLA, recuperação por e-mail, documentos reais de visitantes, múltiplos fornecedores com conversão de unidades.
