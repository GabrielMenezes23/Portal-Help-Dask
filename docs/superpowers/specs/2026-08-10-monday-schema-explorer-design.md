# Monday Schema Explorer — Design

**Data:** 2026-08-10  
**Projeto:** CAF TI Helpdesk  
**Escopo:** inventário automático da estrutura do Monday e preparação do Painel Executivo TI

## Objetivo

Criar uma rotina segura, restrita à TI/admin, capaz de descobrir e armazenar a estrutura real do Monday usada pelo Helpdesk: workspaces, boards, grupos, colunas, tipos, configurações e relações entre boards. O inventário será usado para substituir mapeamentos por nome, completar o modelo de dados do Helpdesk e permitir que o futuro Painel Executivo seja alimentado automaticamente pelo Monday/Supabase, sem depender da exportação Excel.

## Contexto confirmado

O Helpdesk já possui integração server-side com a Monday GraphQL API, autenticação Microsoft, Supabase, webhooks e crons. O cliente atual usa `mondayRequest()` com `MONDAY_API_TOKEN` e `MONDAY_API_VERSION`, portanto nenhuma credencial precisa ser enviada ao navegador.

O board principal atualmente configurado é `18389222247` e o código já conhece parte das colunas, incluindo e-mail, datas, descrição, status, prioridade, tipo de solicitação, justificativa, causa raiz, solicitante, responsável e arquivos.

O arquivo `Tickets_1786386268.xlsx` confirma que a exportação atual possui 36 colunas na aba `tickets`, além de duas abas de Time Tracking. Entre os campos que ainda precisam ser identificados por ID estão `Category`, `Tags`, fornecedor, link/atualização, controles de tempo, relações de hardware/software e outros campos duplicados visualmente.

A exportação também contém o `Item ID (auto generated)`, confirmando que o Excel é um snapshot do board e não uma fonte operacional independente.

## Princípios

1. **ID é a identidade:** integração e analytics usam IDs de board/coluna, nunca dependem do título visível.
2. **Credenciais somente no servidor:** o token Monday nunca é retornado ao cliente nem gravado em logs.
3. **Leitura primeiro:** o Explorer é read-only na API do Monday. Não cria, altera nem exclui boards/colunas.
4. **Supabase como catálogo:** o resultado da descoberta é persistido para consulta, auditoria e comparação entre execuções.
5. **Acesso restrito:** somente `ti_agent` e `admin` podem visualizar o inventário; ações de atualização manual ficam restritas a `admin`.
6. **Compatibilidade API atual:** usar `columns.settings`, não `settings_str`, pois `settings_str` está depreciado desde a API 2025-10.
7. **Tolerância a falhas:** uma consulta parcial ou falha do Monday nunca apaga o último inventário válido.

## Fontes oficiais Monday

- Boards: https://developer.monday.com/api-reference/reference/boards
- Columns: https://developer.monday.com/api-reference/reference/columns
- Workspaces: https://developer.monday.com/api-reference/reference/workspaces
- Connect Boards: https://developer.monday.com/api-reference/reference/connect
- Depreciação de `settings_str`: https://developer.monday.com/api-reference/changelog/deprecating-settings_str-field-on-columns

## Abordagens avaliadas

### A. Descoberta apenas em script local

Consultar o Monday fora do portal e gerar JSON/Markdown manualmente.

**Prós:** simples e rápido para uma única análise.  
**Contras:** vira processo manual, não detecta mudanças futuras e não ajuda a operação do portal.

### B. Descoberta server-side no Helpdesk, persistida no Supabase — escolhida

Adicionar uma camada de inventário à integração existente e uma página administrativa para consulta.

**Prós:** reutiliza token e segurança existentes; atualização automática; histórico; base para mapeamentos e Painel Executivo.  
**Contras:** exige migration, código e testes adicionais.

### C. Consultar o Monday em tempo real a cada abertura do painel

Não persistir inventário; consultar a API sempre que necessário.

**Prós:** sempre atual.  
**Contras:** aumenta latência e consumo da API, cria dependência direta do Monday e dificulta auditoria/diff.

**Decisão:** abordagem B.

## Arquitetura

```text
Monday API
   ↓ read-only
Monday Schema Explorer (server-only)
   ↓
Supabase
   ├── monday_schema_runs
   ├── monday_workspaces
   ├── monday_boards
   ├── monday_groups
   ├── monday_columns
   └── monday_board_relations
         ↓
/admin/integrations/monday/schema
         ↓
Equipe TI / Admin
```

O Explorer reutiliza `mondayRequest()` e o mesmo mecanismo de leitura segura de environment variables já existente.

## Descoberta da conta

A rotina seguirá estas etapas:

1. Listar workspaces acessíveis com paginação.
2. Listar boards ativos acessíveis com paginação.
3. Para cada board relevante, carregar:
   - ID;
   - nome;
   - tipo/kind;
   - estado;
   - workspace;
   - URL;
   - data de atualização;
   - grupos;
   - colunas.
4. Para cada coluna, armazenar:
   - `id`;
   - `title`;
   - `type`;
   - `archived`;
   - `description`;
   - `settings` JSON;
   - `revision` quando disponível.
5. Para colunas `board_relation`, extrair board IDs relacionados de `settings.boardIds` e, quando necessário, consultar `connection_board_ids(connection_id: ...)`.
6. Classificar automaticamente colunas com potencial para o Painel Executivo: categoria, tags, fornecedor, time tracking, origem, satisfação, hardware/software, arquivo e mirror/relation.
7. Persistir um snapshot somente depois que a execução for concluída com sucesso.

## Escopo de boards

A primeira execução deve descobrir todos os boards acessíveis, mas o catálogo marcará como **prioritários** boards que:

- sejam o board configurado em `MONDAY_BOARD_ID`;
- estejam ligados a ele por `board_relation`/mirror;
- contenham termos relacionados a `Tickets`, `TI`, `Hardware`, `Software`, `Incidentes`, `Satisfação`, `NPS` ou `Pesquisa`;
- forem identificados posteriormente como fonte de campos do Painel Executivo.

Isso evita codificar nomes de boards antes da descoberta.

## Modelo de dados

### `monday_schema_runs`

Registro de cada inventário.

Campos principais:

- `id`
- `status`: running/succeeded/failed
- `trigger_source`: manual/cron
- `started_at`
- `finished_at`
- `workspace_count`
- `board_count`
- `column_count`
- `relation_count`
- `error_summary`
- `metadata`

### `monday_workspaces`

- `workspace_id`
- `name`
- `kind`
- `state`
- `description`
- `last_seen_run_id`
- `source_active`

### `monday_boards`

- `board_id`
- `workspace_id`
- `name`
- `board_kind`
- `state`
- `url`
- `updated_at_source`
- `is_priority`
- `priority_reason`
- `last_seen_run_id`
- `source_active`

### `monday_groups`

- `board_id`
- `group_id`
- `title`
- `position`
- `archived`
- `last_seen_run_id`
- `source_active`

### `monday_columns`

- `board_id`
- `column_id`
- `title`
- `type`
- `description`
- `settings` JSONB
- `revision`
- `archived`
- `semantic_hint`
- `last_seen_run_id`
- `source_active`

Chave única: `(board_id, column_id)`.

### `monday_board_relations`

- `source_board_id`
- `source_column_id`
- `target_board_id`
- `relation_type`
- `last_seen_run_id`
- `source_active`

Chave única: `(source_board_id, source_column_id, target_board_id)`.

## Segurança e RLS

Todas as novas tabelas terão RLS habilitado e `FORCE ROW LEVEL SECURITY`.

- `requester`: sem acesso.
- `ti_agent`: SELECT no catálogo.
- `admin`: SELECT no catálogo e pode disparar atualização manual pela aplicação.
- `service_role`: leitura/escrita para o job de sincronização.
- nenhum token, header ou credencial será persistido em `raw_payload`/metadata.

A página `/admin/integrations/monday/schema` deve usar `requireSupport()` para visualização. O endpoint de atualização manual deve validar `requireAdmin()`.

## Página administrativa

Criar `/admin/integrations/monday/schema` com:

### Resumo

- última execução;
- workspaces encontrados;
- boards encontrados;
- colunas encontradas;
- relações encontradas;
- quantidade de boards prioritários.

### Inventário de boards

Tabela pesquisável:

- Board;
- ID;
- Workspace;
- Tipo;
- Estado;
- Atualizado em;
- Prioritário;
- Relações.

### Estrutura do board

Ao selecionar um board:

- grupos;
- lista completa de colunas;
- ID;
- título;
- tipo;
- settings resumidos;
- indicador de relação/mirror/time tracking;
- campo interno já mapeado no Helpdesk, quando houver.

### Mapa Executivo

Tabela comparando:

- campo do Excel;
- coluna provável no Monday;
- ID encontrado;
- tipo;
- status do mapeamento (`confirmado`, `provável`, `não mapeado`, `ambíguo`);
- campo atual no Supabase;
- ação recomendada.

Nenhum mapeamento `provável` será usado automaticamente para escrita. Apenas mapeamentos confirmados entram no pipeline operacional.

## Cruzamento com o Excel

O arquivo de referência tem três abas:

- `tickets` — 36 colunas, 883 linhas totais no arquivo enviado;
- `Controle de tempo Ti` — Time Tracking;
- `Controle de temp---2` — Time Tracking.

A aba `tickets` inclui, entre outros, os campos `Category`, `Tags`, `N° do chamado Fornecedor`, dois controles de tempo, `Hardware Issue`, `Software Service Issue`, `Incidentes`, `Seleção individual` e `Item ID (auto generated)`.

O Explorer não fará upload automático do Excel. O arquivo servirá como referência de homologação para confirmar que a API expõe todos os campos necessários.

## Atualização automática

Adicionar um cron diário, preferencialmente depois da reconciliação da integração Monday, para atualizar o inventário.

Proposta inicial:

```text
06:00 America/Sao_Paulo (09:00 UTC)
```

O inventário muda pouco; atualização diária é suficiente. Também haverá botão administrativo `Atualizar estrutura agora`.

Em falha:

- manter último snapshot válido;
- registrar execução falha;
- não desativar boards/colunas;
- mostrar alerta na página administrativa.

## Compatibilidade com o futuro Painel Executivo

O Explorer é a etapa 1 do Painel Executivo. Depois dele, o desenvolvimento seguirá:

1. confirmar IDs dos campos do board Tickets;
2. expandir o sync Monday → Supabase para categoria, tag, fornecedor, tempos e origem;
3. descobrir boards ligados a hardware/software/incidentes;
4. descobrir a fonte de satisfação/NPS;
5. criar `/admin/executive` usando somente dados estruturados no Supabase;
6. comparar indicador por indicador contra `portal_executivo_tickets_caf`;
7. aposentar o snapshot HTML somente após homologação.

## Erros e observabilidade

- Monday 429/5xx: reutilizar retry exponencial do `mondayRequest()`.
- timeout: falhar a execução preservando snapshot anterior.
- board sem acesso: registrar como erro de execução, sem apagar catálogo anterior.
- settings desconhecido: armazenar JSON sem interpretação destrutiva.
- relação com board inacessível: manter o ID e marcar `target_unresolved=true` no metadata da relação.

## Testes

Cobertura mínima:

- paginação de workspaces;
- paginação/listagem de boards;
- parsing de `columns.settings`;
- detecção de `board_relation`;
- deduplicação por IDs;
- reconciliação somente após sucesso completo;
- preservação do último inventário em falha;
- RLS sem acesso para requester;
- `ti_agent` somente leitura;
- admin autorizado a executar refresh;
- nenhum secret em respostas/logs;
- mapeamento dos IDs já conhecidos do Helpdesk;
- classificação do board principal como prioritário.

## Critérios de aceite da etapa

A etapa está concluída quando:

1. a página administrativa lista a estrutura real do Monday usando o token server-side;
2. o board `18389222247` aparece com todos os grupos e colunas atuais;
3. relações para outros boards ficam identificadas por ID;
4. o catálogo fica salvo no Supabase e atualizável sem deploy;
5. requester não acessa o inventário;
6. TI/admin consegue consultar o inventário;
7. admin consegue forçar atualização;
8. existe um mapa inicial API × Excel × Supabase com os campos não mapeados destacados;
9. falha do Monday não elimina o último inventário válido;
10. CI passa em testes, lint, TypeScript e build.
