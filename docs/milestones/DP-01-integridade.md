# DP-01 — Integridade e exposição do backend

**Estado:** concluída localmente em 2026-10-10 (não commitada; [evidência](../evidence/DP-01.md)) · **Dependência:** DP-00 · [Roadmap](../demo-pilot-roadmap.md)

## Objetivo

Impedir que uma demonstração produza estoque incorreto por coincidência de código ou unidade. Reavaliar dependências e preservar os contratos de transação, autorização e falha da IA existentes.

## Especificação funcional

### I01 — Correspondência exata segura

Hoje `Product` é único por `(stockId, code)` e o caminho exato acumula quantidade sem comprovar fornecedor e compatibilidade de unidade. Para o primeiro piloto, adotar solução conservadora: persistir a origem conhecida do produto e bloquear conflitos ambíguos, sem construir um catálogo universal de fornecedores.

- Adicionar `sourceSupplierCnpj` nullable ao produto e `receivedSupplierCnpj` nullable à sugestão, com migration aditiva. Novos registros oriundos de nota devem preencher os campos com o CNPJ normalizado.
- Match por código só pode acumular automaticamente se origem conhecida coincidir e unidade for igual após normalização de espaços/caixa. `UN` e `CX` não são conversíveis automaticamente.
- Código existente com outro fornecedor ou origem legada desconhecida: abortar a nota com 422, mensagem de conflito e nenhuma escrita de domínio. Não inventar a origem de registros antigos. Ambiente sintético pode ser recriado por DP-02.
- Produto novo conserva origem. Confirmação de sugestão entre códigos diferentes pode representar a decisão humana já suportada, desde que unidades sejam compatíveis; preservar a origem recebida na sugestão como rastreabilidade. Não criar aliases implícitos nesta entrega.
- Rejeição que criaria produto com código já ocupado deve responder 409 e manter a sugestão pendente. Confirmar com unidade incompatível deve responder 422 e manter a sugestão pendente.
- Na transação, revalidar conflitos que possam surgir entre leitura e escrita. Duas primeiras entradas concorrentes com mesmo código e fornecedores diferentes não podem se somar pela implementação de upsert.
- Sem mudança silenciosa de preço/quantidade além da semântica atual; recalcular e testar valores resultantes. Documentar a restrição a conflitos em vez de anunciar suporte completo a múltiplos fornecedores.

### I02 — Falhas e superfície pública

- Manter atomicidade da nota: erro de extração, validação, similaridade ou persistência não cria produtos, sugestões ou chave processada parcialmente.
- Manter ledger obrigatório e telemetria best-effort, quota interna desativada por padrão e nenhuma repetição automática em 429 do provedor.
- Reexecutar auditoria de dependências de produção. Para cada achado registrar pacote, caminho transitivo, exposição no serviço, correção disponível e decisão. Corrigir achados exploráveis no caminho público antes do piloto; justificar descartes com evidência. Não usar `audit fix --force` sem avaliação.
- Conferir limpeza de temporários em sucesso, erro, acesso negado e formato recusado; validar conteúdo do arquivo na medida suportada pela biblioteca, não apenas confiar no MIME enviado pelo cliente. Limite de tamanho e limite backend de 100 itens permanecem.

## Guia de implementação com TDD

1. Criar REDs para colisão entre fornecedores, unidade divergente e corrida de primeira inserção. Usar use case com dublês para regras e PostgreSQL para corrida/transação.
2. Expandir schema, tipos, mappers, builders de auditoria permitidos e repositórios real/in-memory. Campo novo não pode vazar documentos em logs. Registros legados continuam legíveis.
3. Implementar validação antes de montar operações e revalidação dentro da transação; revisar persistência de nota e confirm/reject em conjunto. Não resolver corrida somente no controller.
4. Criar REDs de confirmação/rejeição conflitante; implementar sem consumir a decisão quando ela falha.
5. Revisar dependências em mudanças pequenas; testar as fronteiras realmente afetadas por cada atualização. Registrar diagnóstico sem copiar segredos do ambiente.
6. Executar gates do roadmap, gerar artefatos e documentar migration/compatibilidade de rollback para DP-04.

## Matriz de testes

| ID | Cenário | Asserções |
|---|---|---|
| I-T01 | Mesmo fornecedor/código/unidade | Incremento único e totais esperados |
| I-T02 | Mesmo código, fornecedor diferente | 422; catálogo e chave de nota intactos |
| I-T03 | Mesmo código, UN × CX | 422; nenhuma acumulação |
| I-T04 | Produto legado sem origem | Leitura possível; match exato recusado sem inferência |
| I-T05 | Duas inserções concorrentes conflitantes | No máximo uma nota aceita; nenhuma mistura de origens |
| I-T06 | Confirm/reject simultâneos | Uma decisão efetiva, quantidade aplicada uma vez |
| I-T07 | Rejeição com código ocupado / confirmação incompatível | 409 / 422; sugestão permanece pendente |
| I-T08 | 429/timeout na segunda chamada de similaridade | Nota inteira revertida; categoria correta; sem retry de 429 |
| I-T09 | Falha de ledger / falha de telemetria | Ledger impede chamada; telemetria não desfaz sucesso |
| I-T10 | Token revogado, estoque alheio, upload inválido | Acesso recusado; zero chamada de IA; temporários removidos |
| I-T11 | Migration sobre snapshot sintético antigo | Leitura antiga compatível e novas escritas completas |

## Aceite

Casos acima verdes, auditoria atual triada e nenhum risco explorável conhecido sem tratamento no fluxo exposto. Anexar `docs/evidence/DP-01.md`. Suporte completo a aliases por fornecedor e conversão de unidades permanece evolução futura; a recusa segura de ambiguidades é o contrato desta release.
