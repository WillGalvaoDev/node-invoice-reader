# Roadmap do primeiro piloto de demonstração

**Criado em:** 2026-10-10 · **Base inspecionada:** `90fdfe4` · **Estado atual:** ver §8 (atualizado em 2026-10-13).

Este é o plano de continuidade para a demonstração de portfólio. Substitui a ordem de execução do [roadmap antigo](pilot-readiness-roadmap.md), preservando seu histórico. A [especificação já implementada](portfolio-demo-spec.md) e o [guia existente](portfolio-demo-guide.md) continuam descrevendo a base técnica.

## 1. Onde estamos

O backend já executa o fluxo de cadastro, autenticação, empresa/estoque, extração com IA, atualização de produtos e decisão humana de sugestões. A preparação da demonstração está no commit acima, publicado em `main`.

Evidência **anterior**, registrada na especificação: 481 testes unitários, 74 testes de integração PostgreSQL, dois testes dos PDFs e um fluxo local HTTP com Gemini real. O cenário bem-sucedido consumiu quatro chamadas e 4.020 tokens; isso é uma observação, não orçamento garantido. Não foram repetidos esses testes para escrever este plano.

O roadmap antigo registra deploy do backend em Render/Neon e P5-02 em andamento. **O estado atual do serviço remoto, o SHA publicado e o resultado do CI não foram verificados nesta revisão.** Backend funcional localmente não equivale ao novo piloto publicado e aceito.

Lacunas relevantes: validação remota incompleta; ausência de jornada web; repetição dos mesmos PDFs conflita com chave de nota globalmente única; CNPJ de empresa também é único; correspondência exata por código não distingue fornecedor e pode acumular unidades incompatíveis; faltam ensaio operacional e aceite hospedado.

## 2. Escopo da primeira entrega

- Demonstração técnica com documentos **sintéticos**, contas individuais por convite e dados isolados por visitante.
- Gemini real, com `GEMINI_QUOTA_ENFORCEMENT_ENABLED=false`, medição preservada e kill switch independente. Rate limits HTTP e autenticação continuam ativos.
- Jornada completa: entrar, obter ambiente de exemplo, processar nota inicial e nota complementar, revisar sugestão, confirmar ou rejeitar e consultar estoque persistido.
- A disponibilidade depende do provedor. Remover os tetos internos não reserva capacidade nem garante que todo visitante conseguirá terminar uma operação. Falha temporária deve ser recuperável, visível e sem alteração parcial da nota.
- **Ampliação proposta:** interface web mínima em DP-03 para a demonstração ser utilizável por um visitante sem Postman, Python ou SQL. O plano antigo previa apenas API. Esta é uma decisão de planejamento explícita, não uma funcionalidade já existente. Se o responsável mantiver a apresentação exclusivamente técnica por API, DP-03 pode ser retirada por decisão registrada, e DP-05 passa a usar o roteiro HTTP equivalente.
- Dados de demonstração são descartáveis; a capacidade de reconstruir o ambiente deve ser ensaiada. Não há promessa de continuidade operacional comercial.

Ficam fora: provedor pago, faturamento, orçamento por usuário, recuperação por e-mail, gestão completa de colaboradores, estoques adicionais pela interface, suporte a documentos reais de visitantes, SLA, calibração estatística de IA e período obrigatório de quatro semanas. Troca de senha existente continua disponível. Perda de conta segue procedimento de reemissão de acesso de demonstração, sem recuperar os dados anteriores.

## 3. Milestones e ordem

| ID | Entrega | Dependência | Critério principal | Estado |
|---|---|---|---|---|
| [DP-00](milestones/DP-00-baseline.md) | Baseline e contrato de lançamento | Nenhuma | SHA, CI, ambiente e escopo registrados | Concluída para a base `90fdfe4` em 2026-10-13: serviço Live, SHA do deploy e 2 migrations pendentes registrados; flags remotas conferidas só em DP-04 ([evidência](evidence/DP-00.md)) |
| [DP-01](milestones/DP-01-integridade.md) | Integridade e exposição do backend | DP-00 | Nenhuma fusão silenciosa por fornecedor/unidade; riscos de dependências triados | Concluída localmente, não commitada ([evidência](evidence/DP-01.md)) |
| [DP-02](milestones/DP-02-sessoes-demo.md) | Ambiente reproduzível por visitante | DP-01 | Dois visitantes e duas execuções isoladas, sem ferramentas externas | Concluída localmente, não commitada ([evidência](evidence/DP-02.md)) |
| [DP-03](milestones/DP-03-interface.md) | Jornada web de demonstração | DP-02 | Fluxo completo e falhas compreensíveis no navegador | Concluída localmente, não commitada ([evidência](evidence/DP-03.md)) |
| [DP-04](milestones/DP-04-deploy.md) | Publicação e operação mínima | DP-01–03 | Release identificada, smoke, recuperação e rollback ensaiados | **Bloqueada** (hospedado): preparação e ensaios locais isolados concluídos ([evidência](evidence/DP-04.md)) |
| [DP-05](milestones/DP-05-aceite.md) | Aceite hospedado e material de portfólio | DP-04 | Fluxo real publicado, evidências e instruções para visitante | **Bloqueada** por DP-04 e Gemini real hospedado; material preparado ([evidência](evidence/DP-05.md)) |

A sequência padrão inclui DP-03. Preparar contratos e infraestrutura pode ocorrer antes, mas não marcar uma entrega como aceita sem suas dependências. A próxima tarefa é **DP-00**, incorporando o restante de P5-02; não reiniciar as etapas antigas já concluídas.

## 4. Destino do roadmap antigo

| Trabalho anterior | Situação / destino neste plano |
|---|---|
| P0-01, D1–D8 | Decisões históricas; escopo desta entrega prevalece. 100 itens e medição mantidos; sem tetos internos obrigatórios, coorte de 200 ou quatro semanas como gate. |
| P0-02 | Falha de similaridade distinta de ausência de match já implementada; regressão em DP-01/05. |
| P1-01/02 | Discovery de empresas e estoques reutilizado por DP-02/03. |
| P2-01/02 | JWT e troca de senha reutilizados; revogação e interface verificadas em DP-01/03. |
| P2-03 | Recuperação por e-mail adiada para produto real; acesso demo reemitido pelo operador. |
| P3-00A/00B, P3-01/02/03/04 | Auditoria, telemetria, retenção e reconciliação reutilizadas; operação em DP-04, evidências em DP-05. Não reconstruir subsistemas. |
| P4-01 | Limite de 100 itens mantido na validação backend; não recolocar `maxItems` no schema enviado ao Gemini sem resolver o erro real documentado. |
| P4-02 | Implementada e adaptada pela especificação demo: enforcement desativado por padrão, contabilidade ativa. Paid tier futuro. |
| P4-03 | Convite e proteções HTTP mantidos; isolamento de sessões em DP-02. |
| P5-01 | Deploy histórico existente; identificar release em DP-00 e publicar a nova em DP-04. |
| P5-02 | Pendências de proxy, CORS, cold start e configuração absorvidas por DP-00/04. |
| P5-03 | Para dados sintéticos descartáveis: reconstrução ensaiada em DP-04. Backup/restore com RPO/RTO comercial fica futuro; não declarar P5-03 original concluída. |
| P5-04/05 | Smoke, rollback e runbook mínimo em DP-04. |
| P5-06 | Guard de artefatos existente continua obrigatório nos commits de código. |
| P6-00 | Gate para documentos reais/provedor pago não se aplica ao cenário sintético; permanece futuro. |
| P6-01 | Replanejado como DP-05, com visitante e ambiente hospedado. |
| P6-02/03 | Observação curta após publicação; quatro semanas e calibração de limiares adiadas. |
| M5-02 / bandas de M6-02 do backlog de engenharia | Continuam dependentes de dados reais; batching e calibração não bloqueiam a demonstração. |

## 5. Método de implementação e testes

Para cada mudança de comportamento: teste que reproduz o problema (**RED**), implementação mínima (**GREEN**), refatoração e verificação das fronteiras afetadas. Registrar comando, caso e resultado; não produzir testes artificiais para mudanças puramente documentais.

- Unitários: regras, contratos, limites e classificação de falhas com IA simulada.
- Integração PostgreSQL: transações, unicidade, concorrência, autorização e migrations.
- E2E de navegador: experiência completa com respostas determinísticas do provedor no ambiente de teste. Nenhum endpoint de simulação habilitado no serviço público.
- Aceite hospedado: IA real, execução controlada e manual; não consumir Gemini em todo push ou health check.
- Comandos existentes: `npm test`, `npm run test:integration:postgres:docker`, `npm run typecheck`, `npm run lint`, `npm run prisma:validate`, `npm run verify:production`. Gerar artefatos conforme fluxo do repositório, incluí-los no commit e exigir `npm run verify:artifacts` em checkout limpo. Não editar arquivos compilados manualmente.
- PDFs: `python -m unittest discover -s scripts/tests`, com dependências de `scripts/demo-requirements.txt` em ambiente isolado.

DP-03 deve adicionar e documentar os comandos de testes/build da interface. Não fingir que esses comandos existem hoje. Testes seletivos durante RED/GREEN; suíte e gates relevantes antes de aceitar a milestone. A contagem de testes é evidência auxiliar, não critério de qualidade.

## 6. Definition of Done do piloto

- [ ] Release e URLs identificadas; configuração remota validada sem expor segredos.
- [ ] Conta A não acessa dados, PDFs ou decisões de B, mesmo alterando IDs.
- [ ] Um visitante percorre o cenário sem auxílio técnico na modalidade escolhida.
- [ ] Confirmação e rejeição testadas em execuções independentes; nenhuma dupla movimentação.
- [ ] 429 do Gemini, timeout, nota duplicada e falha de persistência têm resposta correta e estado consistente.
- [ ] Um fluxo completo com IA real termina no ambiente hospedado; disponibilidade insuficiente deixa o aceite pendente.
- [ ] Smoke sem IA, reconstrução de dados demo e rollback de aplicação ensaiados.
- [ ] README, guia e evidências distinguem implementado, demonstrado e futuro.

## 7. Evidências e atualização

Manter `docs/evidence/DP-XX.md` durante a execução: data, SHA, ambiente, casos executados, comandos, resultado, limitações e links para CI/capturas sanitizadas. Registrar a primeira falha e a correção sem tokens, senhas, URLs de banco ou payloads sensíveis. Os arquivos existentes comprovam o que foi realizado localmente; as etapas hospedadas ainda exigem evidência própria.

Estados permitidos: não iniciada → em andamento → bloqueada (causa concreta) ou concluída (evidência anexada). Deploy não conclui automaticamente DP-05. Mudanças de escopo devem alterar este índice e a milestone afetada antes da implementação dependente.

## 8. Situação em 2026-10-13

**Atualização em 2026-10-13:** o responsável confirmou no painel Render que `90fdfe4` está Live; `/health` público respondeu 200. A consulta direta ao Neon encontrou 15 migrations, das quais duas da candidata seguem pendentes. `/version` e `/app/` retornaram 404 na release base. Ver [DP-00](evidence/DP-00.md) e [DP-04](evidence/DP-04.md). A candidata continua sem commit/deploy.

| Marco | Estado | Observação |
|---|---|---|
| DP-00 | Concluída para a base `90fdfe4` | SHA do Render, URL/health e migrations informados/verificados; flags opcionais remotas passam ao gate DP-04 |
| DP-01 | Concluída | Commitada e publicada; CI verde |
| DP-02 | Concluída | Commitada e publicada; CI verde (rotas `/demo` ainda desabilitadas no serviço) |
| DP-03 | Concluída | Commitada e publicada; E2E local e CI (`web`, `web-e2e`) verdes |
| DP-04 | Parcial: publicada, bloqueada por configuração | Release `7b39a57` no ar (API e web com o mesmo SHA, CI verde). `DEMO_ENABLED` não está habilitada no painel; smoke autenticado, medições e rollback público pendentes |
| DP-05 | Bloqueada | Depende de DP-04 e de execução com Gemini real hospedado |

Definition of Done do piloto (§6): **nenhum item pode ser marcado**. Itens com cobertura local automatizada (isolamento entre contas, confirmação/rejeição sem dupla movimentação, 429/duplicata/conflito) ainda exigem o aceite hospedado. Nada foi commitado, publicado nem alterado em serviço hospedado nesta etapa.
