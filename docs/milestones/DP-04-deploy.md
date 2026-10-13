# DP-04 — Publicação e operação mínima

**Estado:** bloqueada na parte hospedada (acesso/autorização de deploy); preparação e ensaios locais concluídos em 2026-10-10 ([evidência](../evidence/DP-04.md)) · **Dependências:** DP-01/02/03, com modalidade definida em DP-00 · [Roadmap](../demo-pilot-roadmap.md)

## Objetivo

Publicar uma release identificável e recuperável, concluindo as verificações úteis de P5-02 e os procedimentos mínimos de P5-03/04/05 para dados sintéticos.

## Requisitos de publicação

- Reutilizar Render/Neon registrados no histórico, verificando antes as capacidades e configuração atuais das contas. Não assumir que recursos ou quotas históricos continuam disponíveis.
- Fixar SHA da release e identificar versão anterior apta a rollback. Exigir CI verde do SHA, incluindo integração e interface quando presente.
- Preservar conexão direta para migrations e pooled para runtime conforme configuração existente; não imprimir URLs. Revisar `render:build` para incluir web e copiar assets se DP-03 os servir no backend.
- Migrations aditivas antes de remover qualquer campo. O build atual aplica migrations antes de publicar: a versão anterior deve continuar funcionando com o schema expandido. Rollback da aplicação não desfaz migration.
- `GEMINI_ENABLED=true`, enforcement interno `false`, `DEMO_ENABLED=true` somente no serviço demo; registrar flags, modelo e parâmetros sem valores secretos.
- Validar proxy pelo tráfego real e CORS conforme a modalidade. Mesma origem dispensa liberar origens externas; origem separada exige allowlist exata. Nunca substituir autorização por CORS.
- Não executar IA no health check nem no smoke de cada deploy. Estado “API saudável” não significa “cota Gemini disponível”.

## Guia de implementação e ensaio

1. Preparar release candidate, revisar migrations e testar upgrade sobre banco sintético da versão anterior. Executar app anterior sobre schema novo para verificar rollback compatível.
2. Criar smoke idempotente com identidade marcada como teste: health, login, discovery, preparação de sessão e consulta vazia. A consulta não deve chamar Gemini. Repetição não deve multiplicar empresas/sessões.
3. Configurar build/start/health/variáveis no ambiente escolhido; registrar nomes e presença, nunca dump integral do ambiente.
4. Publicar pelo fluxo autorizado do projeto. Confirmar SHA, migrations e assets, executar smoke e guardar resultado com timestamp.
5. Medir cold start e primeiro acesso ao banco, anotando tempo observado e limite de timeout configurado. Se o caminho real exceder o timeout, resolver antes do aceite; não compensar com retries automáticos que duplicam chamadas.
6. Validar dois IPs efetivos independentes e tentativa de falsificação de `X-Forwarded-For`; o rate limit não pode colapsar visitantes nem ser contornado por cabeçalho arbitrário. Reusar política de trust proxy existente se comprovada.
7. Ensaiar rollback em ambiente isolado equivalente: trocar app para SHA anterior, smoke sem IA e voltar ao candidato. Registrar diferenças em relação ao serviço público; não declarar ensaio público quando feito só em staging.
8. Ensaiar reconstrução: banco sintético vazio → migrations → conta demo → sessão/PDF → smoke. Medir duração. Isso demonstra reconstrução, não recuperação dos dados perdidos. Nunca apontar scripts de ensaio para banco compartilhado por engano.
9. Criar `docs/demo-operations-runbook.md` com os procedimentos abaixo e `docs/evidence/DP-04.md` com evidências.

## Runbook mínimo obrigatório

Cada procedimento deve ter sintoma, diagnóstico seguro, ação, resultado esperado e condição de escalonamento:

1. Provedor em 429/503: consultar categoria de telemetria, suspender tentativas repetidas, tentar manualmente depois; sem previsão inventada de reset.
2. Kill switch: desativar IA para interromper novas chamadas; explicar efeito sobre solicitações já em andamento.
3. Banco indisponível: verificar conexão/health sem divulgar credenciais; não anunciar rollback de requisição cujo resultado é desconhecido.
4. Nota duplicada ou resultado desconhecido: consultar estoque/sugestões e correlação operacional antes de repetir.
5. Perda de acesso demo: fornecer novo acesso individual por procedimento do operador, preservar isolamento e marcar conta antiga; não solicitar senha antiga nem expor endpoint administrativo público.
6. Reconstrução de ambiente sintético: nomes/IDs alvo explícitos e verificação de escopo; nunca limpeza global por conveniência.
7. Rollback: SHA, comandos/meio de deploy, compatibilidade de schema, smoke e comunicação de indisponibilidade.
8. Telemetria: consultas existentes, retenção de 60 dias e reconciliação. Considerar que reserva usa dia de início e evento pode terminar no dia seguinte; não tratar toda diferença à meia-noite como vazamento de cota.
9. Temporários e logs: remoção de uploads após uso, observação de acúmulo, nenhuma chave/senha/documento no material público.

## Testes e critérios de aceite

| ID | Verificação | Evidência exigida |
|---|---|---|
| D01 | Deploy e assets | SHA da API e web correspondem à release; deep link funciona |
| D02 | Upgrade/rollback | Schema compatível; smoke verde antes/depois |
| D03 | Proxy e rate limit | IPs independentes; spoofing não cria identidade arbitrária |
| D04 | CORS | Origem permitida funciona; externa negada quando aplicável; cliente sem Origin segue autenticação |
| D05 | Cold start / health | Tempos medidos; SELECT de health, cache e limitação funcionando |
| D06 | Smoke | Zero evento de IA associado; repetição segura |
| D07 | Reconstrução | Ambiente isolado recupera capacidade funcional; perda de dados descartáveis explícita |
| D08 | Encerramento | Teste local de SIGTERM e drenagem; evidência remota se disponível no deploy natural |

Não provocar restart público só para obter SIGTERM. Ausência dessa observação remota deve ficar registrada, sem bloquear sozinha a demonstração se shutdown local e release estiverem verificados. Os demais gates acima aplicáveis bloqueiam DP-04. Backup/restore comercial, monitoramento 24 horas e RPO/RTO contratual ficam futuros.
