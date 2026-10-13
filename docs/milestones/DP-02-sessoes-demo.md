# DP-02 — Ambiente reproduzível por visitante

**Estado:** concluída localmente em 2026-10-10 (não commitada; [evidência](../evidence/DP-02.md)) · **Dependência:** DP-01 · [Roadmap](../demo-pilot-roadmap.md)

## Objetivo

Permitir que cada visitante prepare e repita o cenário sem colisões com outras pessoas, sem executar Python/SQL e sem compartilhar credenciais. Reutilizar os PDFs sintéticos e a lógica de domínio existente.

## Contrato proposto

Os endpoints abaixo **ainda não existem**. Exigem autenticação, autorização por dono, validação de entrada, proteção HTTP e feature flag `DEMO_ENABLED`, desativada por padrão fora do ambiente de demonstração.

| Endpoint | Contrato |
|---|---|
| `POST /demo/sessions` | Corpo `{}`; cria uma sessão ativa por usuário ou devolve a existente. 201 para criação; 200 para reutilização. |
| `GET /demo/sessions/current` | Retorna sessão ativa ou 404; não expõe sessões de terceiros. |
| `GET /demo/sessions/:id/documents/:kind` | Download autorizado; `kind` apenas `initial` ou `followup`; PDF com chave exclusiva da sessão. |
| `POST /demo/sessions/:id/restart` | Corpo `{}`; arquiva sessão ativa e cria outra vazia. Repetir para o mesmo ID antigo retorna sua mesma sucessora, sem criação em cascata. |

Resposta de sessão no envelope atual: `id`, `companyId`, `stockId`, estado, nomes/URLs relativos dos dois documentos e descrição dos resultados esperados. IDs e proprietário são definidos no servidor. Não devolver senhas, convite, tokens de terceiros ou configuração do provedor.

### Regras de dados

- Criar `DemoSession` com dono, empresa/estoque, estado, identificação única dos documentos e relação com sucessora. Garantir uma ativa por usuário no banco, com transação e restrição apropriada; não confiar em consulta prévia sob concorrência.
- Criar empresa sintética com CNPJ válido e exclusivo, com algoritmo determinístico/testável de dígitos verificadores e tratamento de colisões. Número é dado de teste; não alegar que jamais corresponde a uma empresa real.
- Gerar duas chaves distintas de 44 dígitos por sessão, respeitando as validações atuais. Criar restrição de unicidade para reservas das chaves antes de o documento virar `ProcessedInvoice`; retry limitado em colisão, sem loop infinito.
- Não alterar a unicidade global de `ProcessedInvoice.accessKey` para acomodar exemplos. Reenviar o mesmo PDF na mesma sessão continua duplicata; reiniciar fornece outros documentos e estoque vazio.
- O bootstrap não chama IA nem insere os produtos esperados: estoque só muda pelo upload e pela decisão real. Não simular sucesso como se tivesse havido processamento.
- Gerar PDFs a partir de `examples/demo/scenario.json`. Preferência: renderer TypeScript no backend para não exigir Python em produção; selecionar biblioteca na implementação, registrar avaliação e manter testes de paridade com o gerador Python. PDFs oficiais existentes permanecem fixtures de referência.
- Downloads privados com `Cache-Control: no-store` e sem token em query string. Não servir arquivos de uma pasta pública previsível. Layout deve identificar claramente “documento sintético de demonstração”.
- Reiniciar arquiva e troca a sessão; não apaga registros compartilhados, ledger nem telemetria. Limpeza futura usa IDs explicitamente marcados como demo, modo de simulação e escopo verificado. Nada de `TRUNCATE` do banco compartilhado.
- Rate limit de preparação/reinício protege criação de registros, separado da cota de IA. Proposta inicial: cinco comandos por minuto por usuário, configurável e testada. Não reintroduzir limite diário de operações de IA.

## Guia de implementação com TDD

1. Criar testes de contrato e autorização para os quatro endpoints antes de registrá-los nas rotas.
2. Especificar schema/migration aditiva e repositório de sessão; testar disputa por criação e reinício com PostgreSQL real.
3. Extrair/reutilizar criação transacional de empresa/estoque sem duplicar regras do domínio. Criar sessão e recursos atomicamente.
4. Implementar gerador de dados e renderer PDF. Verificar texto, número de páginas, chaves e totais; renderizar visualmente os dois PDFs. Fontes/acentos devem funcionar no ambiente de deploy.
5. Implementar download com autorização antes da geração. Verificar tamanho e eliminar temporários, se usados.
6. Adicionar feature flag e rate limit; mostrar como habilitar apenas no ambiente demo. Documentar contratos para DP-03.
7. Atualizar guia com reinício pela API e manter o comando Python como alternativa de desenvolvimento.

## Testes obrigatórios

| ID | Caso | Resultado |
|---|---|---|
| S01 | Usuários A/B preparam sessões | IDs/CNPJ/chaves distintos e estoques vazios |
| S02 | A solicita sessão/PDF/reinício de B | Resposta anti-enumeração consistente; nenhuma alteração |
| S03 | Duas preparações simultâneas de A | Uma sessão ativa; nenhum recurso órfão |
| S04 | Duplo clique/retry no reinício | Uma sucessora, mesma resposta lógica |
| S05 | Feature flag desligada | Rotas indisponíveis, sem criação |
| S06 | Dados/arquivos gerados | Mesmos itens/totais das fixtures, chaves novas, PDF legível |
| S07 | Upload repetido / sessão nova | Duplicata não movimenta; sessão nova processa normalmente |
| S08 | Falha na criação de empresa/PDF | Transação sem recursos parciais; download pode ser tentado de novo |
| S09 | Rate limit excedido | 429 local; nenhuma chamada de IA |
| S10 | Fluxo com provedor determinístico | Inicial CAN-A=10; final confirmada CAN-A=15/CAD-A=1; rejeitada CAN-A=12/CAD-A=1/CAN-B=3 |

## Aceite

Dois visitantes concluem cenários independentes em testes; reinício funciona sem intervenção no banco; bootstrap/download consomem zero chamadas de IA. Registrar `docs/evidence/DP-02.md`, contratos e exemplos sanitizados. Estado de sessão é isolamento/reprodução, não reserva de capacidade do free tier.
