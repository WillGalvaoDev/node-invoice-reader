# DP-05 — Aceite hospedado e apresentação do portfólio

**Estado:** bloqueada (depende de DP-04 e de fluxo real com Gemini hospedado); material preparado ([evidência](../evidence/DP-05.md)) · **Dependência:** DP-04 · [Roadmap](../demo-pilot-roadmap.md)

## Objetivo

Provar que a release publicada entrega a demonstração completa e preparar acesso e material para um visitante. Encerrar o piloto somente com evidência do fluxo real hospedado.

## Roteiro de aceite

1. Registrar data, SHA, URLs, modalidade e ambiente. Usar conta individual de teste e documentos gerados para uma sessão nova.
2. Percorrer cadastro/login, preparação e download sem Python/SQL/Postman na modalidade web. No modo API explicitamente escolhido, fornecer coleção/roteiro reproduzível com as mesmas asserções.
3. Enviar nota inicial ao Gemini real: produto CAN-A com quantidade 10; nenhuma sugestão pendente.
4. Enviar nota complementar: CAN-A recebe 2, CAD-A nasce com 1; CAN-B com quantidade 3 é candidato à sugestão para CAN-A. Antes de decidir, CAN-A deve ser 12, nunca 15.
5. Confirmar sugestão: CAN-A=15 e CAD-A=1. Consultar novamente, sair/entrar e confirmar persistência. Reenviar nota ou decidir novamente não pode somar de novo.
6. Em sessão independente, executar caminho de rejeição: CAN-A=12, CAD-A=1 e CAN-B=3. A matriz automatizada deve sempre cobrir ambos os caminhos; o aceite real deve registrar ambos para a release, com chamadas planejadas.
7. Usar segunda conta para verificar isolamento de empresas, estoques, PDFs e decisões no ambiente publicado. Não compartilhar JWT para simplificar o roteiro.
8. Consultar telemetria e ledger com acesso do operador; registrar chamadas, tokens e latência observados sem conteúdo sensível. Comparar com a evidência local anterior, sem transformá-la em garantia de custo ou desempenho.

O cenário anterior usou quatro chamadas por execução completa sem retries. Duas execuções podem demandar cerca de oito chamadas, mas o comportamento do modelo e os retries permitidos alteram esse número. Consultar disponibilidade do provedor na ocasião; não fixar como verdade os limites antigos da conta. Não esgotar propositalmente a cota para testar erros.

### IA não determinística e falhas

- O roteiro automatizado usa respostas fixas e prova regras da aplicação. O real prova integração e utilidade do cenário.
- Se o modelo não produzir a sugestão esperada, registrar o resultado e investigar fixture/prompt/validação; não forçar uma sugestão nos dados nem ocultar o desvio. O fluxo de revisão precisa ser demonstrado antes do aceite.
- Se houver 429 ou indisponibilidade, verificar mensagem e ausência de alteração parcial, registrar tentativa e deixar o aceite real pendente. Retomar quando houver capacidade; um vídeo anterior não substitui evidência da release.
- Erros difíceis de induzir de forma segura no serviço público (falha no commit, timeout controlado, 429 upstream) são exercitados em ambiente equivalente com provider de teste. Identificar explicitamente a origem da evidência.

## Matriz final de testes

| ID | Caso | Ambiente |
|---|---|---|
| A01 | Fluxo confirmando com persistência após login | Hospedado + Gemini real |
| A02 | Fluxo rejeitando com saldo correto | Hospedado + Gemini real |
| A03 | Isolamento entre duas contas | Hospedado, sem IA adicional quando possível |
| A04 | Duplicata e decisão repetida | Automatizado; verificar também no roteiro real, contabilizando extração adicional da duplicata |
| A05 | 429 upstream, timeout e falha de banco | Integração/E2E controlado; sem falha parcial |
| A06 | Conflito de fornecedor/unidade | PostgreSQL + E2E determinístico |
| A07 | Visitante sem ajuda técnica | Navegador hospedado, ou roteiro HTTP se modalidade API |
| A08 | Smoke após publicação | Hospedado, zero IA |

## Guia de entrega

1. Preparar checklist e capturas, executar roteiro uma vez por caminho; evitar repetir chamadas reais apenas para melhorar vídeo.
2. Salvar `docs/evidence/DP-05.md` com resultado por caso, SHA e limitações. Evidência pública deve ocultar credenciais e metadados internos; nomes/documentos devem ser sintéticos.
3. Atualizar README com URL, instruções de convite, roteiro curto, arquitetura e testes. Separar recursos disponíveis de intenções futuras.
4. Atualizar `portfolio-demo-guide.md` para a modalidade publicada; incluir reinício, cota indisponível e tempo observado de primeiro acesso sem prometer SLA.
5. Produzir vídeo curto ou capturas do fluxo e uma explicação técnica: onde IA atua, validação determinística, transação, decisão humana, autorização e telemetria. Não apresentar contagem de testes como prova isolada de qualidade.
6. Entregar instrução operacional de acesso: convite compartilhado fora do bundle, conta individual e documentos de exemplo; não publicar credenciais reutilizáveis no repositório.
7. Registrar problemas encontrados após as primeiras visitas no backlog. Não exigir quatro semanas para declarar a demonstração disponível, nem calibrar limiares com amostra insuficiente.

## Critério de conclusão

A01–A08 aprovados nos ambientes indicados, DP-04 aceita, material atualizado e visitante consegue concluir a jornada na modalidade acordada. Publicar no roadmap “piloto de demonstração concluído” com data, SHA e evidência. Isso não significa prontidão comercial, capacidade garantida do free tier ou suporte a documentos reais.
