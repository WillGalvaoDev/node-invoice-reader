# DP-03 — Jornada web mínima

**Estado:** concluída localmente em 2026-10-10 (não commitada; [evidência](../evidence/DP-03.md)) · **Dependência:** DP-02 · [Roadmap](../demo-pilot-roadmap.md)

## Objetivo e decisão de escopo

Entregar uma URL pela qual um visitante convidado consegue demonstrar o fluxo sozinho. Esta interface amplia o plano antigo, que previa API apenas. A modalidade web é a proposta padrão deste roadmap; se for retirada por decisão de escopo, preservar o roteiro equivalente via HTTP em DP-05.

## Fluxos e critérios funcionais

1. **Apresentação:** explicar extração, validação e revisão humana; informar uso de dados sintéticos e disponibilidade variável. Botão de entrada, sem expor convite ou chave de IA no bundle.
2. **Cadastro/login:** consumir `/users` e `/login`; convite fornecido pelo operador. Validação acessível, erros específicos permitidos pela API e prevenção de submissão duplicada.
3. **Preparação:** obter/criar sessão de DP-02; exibir empresa/estoque atuais e botões para baixar exemplos. Mostrar estoque vazio antes do primeiro upload.
4. **Upload:** selecionar PDF e enviar multipart com estoque da sessão. Indicar envio/processamento sem porcentagem fictícia. Uma solicitação por vez na tela; botão desabilitado enquanto pendente. Cancelar no navegador não prova que o servidor cancelou.
5. **Resultado:** distinguir itens aplicados de sugestões pendentes. Mostrar valores, unidades e origem; nunca contabilizar a quantidade pendente como já disponível.
6. **Revisão:** item recebido e produto sugerido lado a lado, quantidade, unidade, motivo e confiança como indicação do modelo. Confirmar/rejeitar explicitamente; atualizar estoque e lista após resposta. Decisão já tomada em outra aba deve recarregar o estado, não somar localmente.
7. **Consulta:** listar estoque e sugestões pendentes usando APIs existentes; tratar paginação real, vazio, erro e carregamento. Reentrar encontra estado persistido.
8. **Conta/sessão:** logout apaga token; troca de senha explica nova autenticação; reinício pede confirmação pois troca o ambiente visível, arquivando o anterior. Não oferecer recuperação por e-mail inexistente.

### Erros e recuperação

| Situação | Comportamento visível |
|---|---|
| 401 / token revogado | Encerrar sessão local e solicitar login |
| 403 / 404 | Informar indisponibilidade/permissão sem expor recursos de outro usuário |
| 409 nota duplicada | Explicar que a nota já foi processada e recarregar estoque/sugestões |
| 422 | Mostrar problema do documento ou conflito de unidade/origem; nada de sucesso parcial |
| 429 local | Orientar aguardar; usar `Retry-After` somente se a resposta o fornecer |
| 503 do provedor | Informar indisponibilidade temporária e oferecer nova tentativa manual; não prometer horário de retorno |
| Timeout/rede após envio | Estado desconhecido: consultar estoque/sugestões antes de reenviar; não afirmar que houve rollback |

## Guia de implementação com TDD

1. Criar aplicação em `web/`, com scripts e lockfile documentados, preferindo TypeScript e ferramentas simples. Registrar escolha de framework/test runner antes de adicionar dependências; não migrar o backend para acomodar a UI.
2. Organizar cliente HTTP tipado a partir dos contratos reais dos controllers/schemas. Centralizar parsing de envelope e erros. Token inicialmente em memória; refresh exige login, mas sessão demo é reencontrada via API. Não colocar JWT em URLs ou logs.
3. Criar REDs para login, expiração e transições de upload/decisão; implementar telas por fluxo. Usar fixtures de contrato e testes de integração de componentes.
4. Acrescentar E2E com API e PostgreSQL de teste e provider determinístico injetado apenas na composição de teste. Não transformar os endpoints públicos em simulador configurável pelo visitante.
5. Configurar build estático e rotas. Preferir servir a interface e API na mesma origem pelo backend existente para simplificar o primeiro deploy; montar API antes do fallback da SPA. Fallback não pode transformar 404 de API em HTML 200.
6. Caso seja necessária origem separada, registrar URLs e CORS explícito em DP-04. Variáveis públicas só contêm configuração pública; build não recebe segredo Gemini/banco/JWT/convite.
7. Atualizar CI com testes e build da interface, mantendo jobs atuais. Documentar estratégia de artefatos web (gerados no build de deploy, sem rastrear caches ou `node_modules`).

## Testes e aceite

- E2E: cadastro → login → sessão → dois uploads → confirmar → estoque esperado; repetir em sessão nova com rejeição.
- Reentrada, paginação, duplo clique, decisão em outra aba, sessão expirada durante upload e reinício interrompido.
- Simular todos os erros da tabela; nenhum retry automático de upload/decisão/IA. Downloads privados devem usar cliente autenticado e liberar URLs de objetos no navegador.
- Conteúdo extraído malicioso deve aparecer como texto; sem HTML bruto. Verificar bundle/mapas e logs quanto a segredos.
- Navegação por teclado, foco após erros, nomes acessíveis, anúncio de carregamento e contraste. Verificar desktop e largura de 360 px, sem botões ou quantidades cortados.
- Deep link/refresh funcionam; chamadas a API desconhecida mantêm o contrato de erro da API.

Aceitar quando a jornada determinística estiver verde, a interface permitir retomada sem SQL e o CI executar suas verificações. Registrar `docs/evidence/DP-03.md` com capturas sanitizadas. O teste com Gemini real hospedado pertence a DP-05; não alegar validação real a partir de mocks.
