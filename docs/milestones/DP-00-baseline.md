# DP-00 — Baseline e contrato de lançamento

**Estado:** concluída para o baseline `90fdfe4` em 2026-10-13; conferência das flags opcionais remotas segue em DP-04 ([evidência](../evidence/DP-00.md)) · **Dependências:** nenhuma · [Roadmap](../demo-pilot-roadmap.md)

## Objetivo

Estabelecer exatamente qual versão está localmente, no GitHub e no ambiente hospedado, e transformar pendências de P5-02 em verificações executáveis. Evitar implementar novamente o que já existe ou usar evidência local como prova de deploy.

## Entregas e requisitos

1. Inventário com SHA local/remoto/publicado, URL da API, banco/ambiente identificado sem credenciais, última execução de CI e situação das migrations.
2. Contrato da demonstração: dados sintéticos, contas por convite, uma empresa/estoque por sessão de exemplo, cotas internas desligadas e proteções HTTP mantidas.
3. Registrar a modalidade planejada: web conforme DP-03; API se houver decisão explícita de manter o escopo antigo. A modalidade determina o aceite e a configuração de CORS.
4. Inventário de configuração por nome e presença, sem valores secretos: Gemini, JWT, convite, conexão direta/pool, origens, proxy, timeout e encerramento.
5. Lista de gaps classificada: bloqueadores do primeiro piloto, melhorias opcionais, requisitos comerciais futuros. Não usar números históricos de vulnerabilidades como diagnóstico atual.

## Guia de implementação

1. Ler roadmap anterior, decisões, especificação demo e guia; confrontar estados com `git log` e código.
2. Consultar resultado do CI do SHA escolhido e metadados do deploy. Se não houver acesso, registrar exatamente o acesso faltante; continuar auditoria local, mas deixar a validação remota pendente.
3. Consultar `/health` remoto e confirmar release por metadados da plataforma. Se necessário, planejar um identificador público de versão não sensível; não inferir SHA só por HTTP 200.
4. Consultar status de migrations com a conexão apropriada, sem aplicar migrations nesta etapa de inventário.
5. Documentar diferenças entre configuração pretendida e remota. JWT deve ter origem aleatória documentada; comprimento mínimo não demonstra entropia. Não rotacionar segredos sem considerar revogação de sessões.
6. Criar `docs/evidence/DP-00.md` e atualizar estados deste roadmap. Preservar documentos antigos como histórico, sem apagar decisões anteriores.

## Testes e verificações

| ID | Verificação | Resultado exigido |
|---|---|---|
| B01 | SHA local × remoto × deploy | Valores explícitos; diferenças explicadas |
| B02 | CI da release base | Resultado consultado, falhas listadas |
| B03 | Health remoto | Resposta e horário registrados; sem inferir qualidade do fluxo de IA |
| B04 | Migrations | Aplicadas/pendentes identificadas por nome |
| B05 | Configuração | Sem segredo publicado; flags e origens identificadas |
| B06 | Escopo documental | Ausência de gates contraditórios para a mesma entrega |

Não exige TDD para inventário. Qualquer novo endpoint de versão exige teste de contrato e teste garantindo ausência de configuração sensível.

## Aceite e próximo passo

Concluir quando o inventário estiver verificável e os gaps tiverem destino. Ausência de acesso remoto mantém B01/B03/B04 pendentes e impede declarar baseline remoto confirmado. DP-01 pode preparar correções locais, mas DP-04 não pode aceitar a publicação sem fechar esse inventário.
