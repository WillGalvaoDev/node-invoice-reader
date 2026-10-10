# Demonstração de portfólio — DocScan

O objetivo atual é demonstrar extração por IA, validação, autorização, transações,
revisão humana, auditoria e observabilidade. A API usa Gemini real. Não há frontend.
Especificação e decisões: [portfolio-demo-spec.md](portfolio-demo-spec.md).

## Configuração

No ambiente que executa o backend:

```dotenv
GEMINI_ENABLED=true
GEMINI_QUOTA_ENFORCEMENT_ENABLED=false
```

Os defaults já são esses. A nova flag desliga somente os tetos diários internos;
o ledger continua medindo e a proteção HTTP continua ativa. Alterar configuração
requer reiniciar o processo. O código atualizado precisa ser implantado antes de
ter efeito no Render. Esta implementação não alterou o ambiente hospedado.

O Gemini pode recusar chamadas mesmo com enforcement desligado. Não há garantia
de cota disponível por visitante. Erro 503 com a mensagem de limite temporário
significa que a nota não alterou o estoque; não repita uploads continuamente.

## Documentos prontos

- [Primeira operação: um produto](../output/pdf/demo-inicial.pdf).
- [Operação ampliada: três linhas](../output/pdf/demo-completa.pdf).
- [Dados estruturados de referência](../examples/demo/scenario.json).

Todos são sintéticos e estão marcados como sem valor fiscal. O primeiro documento
em estoque vazio usa uma extração, sem similaridade. O segundo usa uma extração e
duas similaridades. O catálogo pequeno é oferecido inteiro ao matching, inclusive
para o caderno, que deve receber `no_match`. Sem retries: **1 + 3 = 4 chamadas**.
Retries por erro transitório podem aumentar esse número.

## Roteiro pela API (Postman, Insomnia ou cliente HTTP)

Use a URL do backend escolhido. Nas rotas protegidas, envie
`Authorization: Bearer <token>`. Para JSON, envie `Content-Type: application/json`.
Nenhuma destas instruções exige acesso direto ao banco.

1. Cadastre uma conta com `POST /users`:

   ```json
   {"name":"Visitante Demo","email":"visitante@example.test","password":"escolha-uma-senha","inviteCode":"convite-fornecido-pelo-operador"}
   ```

   Use o convite configurado e uma conta própria ou uma conta de demonstração
   previamente fornecida. Não publique senhas ou convites no repositório.

2. Faça `POST /login` com `email` e `password`; guarde `data.token`.
3. Para a primeira execução em banco de demonstração vazio, faça `POST /companies`:

   ```json
   {"name":"Empresa Sintetica Demo","cnpj":"11222333000181"}
   ```

   Esse CNPJ passa na validação matemática e é usado somente como fixture. A
   empresa tem CNPJ único: se já existir, reutilize a empresa da sua conta via
   `GET /companies`; não tente recriá-la para outro visitante. O operador pode
   fornecer uma conta de demonstração com empresa/estoque já preparados.

4. Descubra o estoque via `GET /companies/:companyId/stocks` e guarde o `id` em
   `data.items`. A criação também retorna `data.defaultStock.id`.
5. Faça `POST /invoices/upload`, body **multipart/form-data**, campos `stockId`
   (texto) e `file` (arquivo `demo-inicial.pdf`). Não fixe manualmente o boundary.
   Espere 201, um produto `CAN-A`, quantidade 10, preço unitário 2, sem sugestões.
6. Confira `GET /products?stockId=<id>`.
7. Envie `demo-completa.pdf` ao mesmo estoque. Resultado esperado:

   | Linha | Resultado esperado antes da decisão humana |
   |---|---|
   | CAN-A, 2 unidades | Quantidade acumulada da caneta: 12 |
   | CAD-A, 1 unidade | Caderno novo, preço unitário 15 |
   | CAN-B, 3 unidades | Sugestão pendente apontando para CAN-A |

8. Confira `data.suggestions` ou `GET /stocks/:stockId/suggestions`. Revise os
   itens antes de decidir; uma resposta diferente da IA não deve ser forçada.
9. Para confirmar, envie `POST /suggestions/:suggestionId/confirm`, body `{}`.
   Esperado: CAN-A com 15 unidades, CAD-A com 1. Para rejeitar, use `/reject`:
   esperado: CAN-A com 12, CAD-A com 1 e CAN-B novo com 3. São alternativas para
   uma sugestão; uma sugestão já decidida não deve ser decidida novamente.
10. Confira o catálogo. Confirmar/rejeitar não faz nova chamada ao Gemini.

## Repetir sem desativar a idempotência

A chave de acesso é única globalmente no banco. Trocar de usuário ou estoque não
permite reenviar a mesma chave já processada. Reenvio pode consumir IA antes do
409, porque a verificação autoritativa de duplicidade acontece na transação final.

Os PDFs prontos não exigem Python para uso. Para gerar outro par:

```sh
python -m pip install -r scripts/demo-requirements.txt
python scripts/generate-demo-pdfs.py --run-id visitante-02 --output-dir tmp/demo-visitante-02
```

Escolha um `run-id` novo por sessão. O mesmo identificador gera as mesmas chaves;
outro produz chaves diferentes de 44 dígitos. O manifesto gerado contém o resultado
esperado. O gerador só escreve arquivos locais, sem chamar IA nem alterar banco.

Se repetir no mesmo estoque, as quantidades somam; os números do roteiro pressupõem
estoque inicialmente vazio. Não excluir notas processadas para simular novidade.

## Evidência obtida em 2026-10-10

- API HTTP real, PostgreSQL 16 local descartável, Gemini `gemini-2.5-flash` real,
  PDFs sintéticos, enforcement desligado e no máximo uma tentativa por chamada.
- Cadastro 201, login 200, empresa 201, discovery 200, dois uploads 201,
  confirmação 200 e consulta final 200.
- Primeiro upload: uma extração, aproximadamente 5,16 s e 1.280 tokens.
- Segundo upload: extração aproximadamente 6,26 s / 1.645 tokens; similaridades
  aproximadamente 1,68 s / 472 tokens e 1,98 s / 623 tokens.
- Ledger global: **4 chamadas, 4.020 tokens, 0 reservas pendentes**. Quatro eventos
  persistidos, todos bem-sucedidos. Catálogo final: 15 canetas e 1 caderno.
- Esses valores são uma observação, não SLA nem estimativa de disponibilidade.
- Antes da correção DEMO-06, uma tentativa HTTP completa falhou em 400 upstream
  por complexidade do schema; foi contabilizada como uma tentativa sem uso
  informado. Uma chamada diagnóstica isolada reproduziu o mesmo erro. O ciclo
  bem-sucedido acima usou um banco descartável novo; esses diagnósticos não estão
  incluídos nos quatro eventos desse ciclo.
- A rejeição de sugestão e os cenários de falha foram verificados nos testes com
  PostgreSQL real e SDK substituído. Não são alegados como chamadas ao Gemini real.

## Operação e evolução

O [runbook de telemetria](telemetry-runbook.md) permite consultar chamadas, falhas,
tokens e reconciliação. `provider_rate_limit` identifica recusas 429 do provedor.
Tetos desligados não significam perda de observabilidade. Reservas residuais
continuam exigindo investigação; o script de reconciliação não corrige dados.

Para reativar a política histórica, configure `GEMINI_QUOTA_ENFORCEMENT_ENABLED=true`
e os tetos. A faixa atual de 1–20 e os defaults 18/5 são históricos; uma política
comercial precisa rever números e capacidade do provedor. Não ativar faturamento
supondo que essa flag já implementa um limite financeiro.

Backup/restore ensaiado, recuperação de senha e validações completas de operação
permanecem evolução futura. O escopo atual não representa lançamento comercial.
