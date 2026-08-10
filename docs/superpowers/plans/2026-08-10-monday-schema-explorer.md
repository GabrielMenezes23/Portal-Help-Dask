# Monday Schema Explorer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Descobrir, persistir e exibir com segurança a estrutura real do Monday — workspaces, boards, grupos, colunas, settings e relações — e produzir um mapa API × Excel × Supabase que prepare o Helpdesk para o Painel Executivo automático.

**Architecture:** Reutilizar `mondayRequest()` no servidor para consultas GraphQL read-only, persistir snapshots reconciliados no Supabase e expor uma página administrativa protegida por `requireSupport()`. O inventário só substitui registros ativos após uma execução completa bem-sucedida; falhas preservam o último snapshot válido.

**Tech Stack:** Next.js 16, React 19, TypeScript 6, Supabase PostgreSQL/RLS, Monday GraphQL API `2026-07`, Vercel Cron, Node test runner.

## Global Constraints

- Board principal atual: `18389222247`.
- Token Monday permanece exclusivamente server-side; nenhum token, header ou secret em resposta, banco ou log.
- Explorer é read-only na Monday API; não cria, altera ou exclui boards/colunas.
- Usar `columns.settings`; não introduzir novo uso de `settings_str`.
- Requester não acessa o catálogo.
- `ti_agent` e `admin` podem visualizar o catálogo.
- Apenas `admin` pode disparar atualização manual.
- `service_role` é o único papel com escrita nas tabelas de catálogo.
- Falha parcial não desativa workspaces, boards, grupos, colunas ou relações do último snapshot válido.
- Cron diário: `09:00 UTC` = `06:00 America/Sao_Paulo`.
- Excel de homologação: `/mnt/data/Tickets_1786386268.xlsx` possui `tickets!A1:AJ883`, `Controle de tempo Ti!A1:G4152` e `Controle de temp---2!A1:G1458`.
- Cabeçalho da aba `tickets`, linha 3, possui 36 campos e deve ser representado no mapa estático de homologação.

---

## File Structure

### Novos arquivos

- `supabase/migrations/20260810154000_monday_schema_explorer.sql` — catálogo, RLS e índices.
- `src/lib/monday/schema-domain.ts` — tipos puros, normalização, priorização e parsing de relações/settings.
- `src/lib/monday/schema-domain.test.ts` — testes unitários do domínio.
- `src/lib/monday/schema-client.ts` — consultas read-only de workspaces, boards e detalhes.
- `src/lib/monday/schema-sync.ts` — orquestra execução, persistência e reconciliação segura.
- `src/lib/monday/schema-query.ts` — leitura server-side do catálogo para UI.
- `src/lib/monday/executive-field-map.ts` — referência Excel × IDs conhecidos × semântica esperada.
- `src/lib/monday/executive-field-map.test.ts` — validação dos 36 campos e IDs confirmados.
- `src/components/monday-schema-refresh-button.tsx` — refresh manual admin.
- `src/app/admin/integrations/monday/schema/page.tsx` — página do inventário.
- `src/app/api/admin/integrations/monday/schema/refresh/route.ts` — refresh manual admin.
- `src/app/api/cron/monday-schema/route.ts` — refresh diário protegido por `CRON_SECRET`.

### Arquivos modificados

- `src/lib/monday/client.ts` — somente se necessário para exportar/reutilizar tipos auxiliares; não duplicar `mondayRequest()`.
- `src/app/admin/integrations/monday/page.tsx` — link para Explorer e resumo do último inventário.
- `src/components/app-shell.tsx` — manter integração no menu admin; não adicionar menu para requester.
- `vercel.json` — cron `0 9 * * *`.
- `package.json` — incluir novos testes no script `test`.
- `README.md` — documentar o Explorer e a fonte do mapa executivo.

---

### Task 1: Criar schema persistente e RLS do Explorer

**Files:**
- Create: `supabase/migrations/20260810154000_monday_schema_explorer.sql`

**Interfaces:**
- Produces: tabelas `monday_schema_runs`, `monday_workspaces`, `monday_boards`, `monday_groups`, `monday_columns`, `monday_board_relations`.
- Consumes: `app_private.has_support_access()` e `app_private.is_admin()` já existentes.

- [ ] **Step 1: Escrever a migration completa**

Criar enum e tabelas com este contrato:

```sql
begin;

do $$
begin
  create type public.monday_schema_run_status as enum ('running', 'succeeded', 'failed');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.monday_schema_trigger_source as enum ('manual', 'cron');
exception when duplicate_object then null;
end $$;

create table if not exists public.monday_schema_runs (
  id uuid primary key default gen_random_uuid(),
  status public.monday_schema_run_status not null default 'running',
  trigger_source public.monday_schema_trigger_source not null,
  triggered_by uuid references public.profiles(id) on delete set null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  workspace_count integer not null default 0 check (workspace_count >= 0),
  board_count integer not null default 0 check (board_count >= 0),
  group_count integer not null default 0 check (group_count >= 0),
  column_count integer not null default 0 check (column_count >= 0),
  relation_count integer not null default 0 check (relation_count >= 0),
  error_summary text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint monday_schema_runs_finished_state check (
    (status = 'running' and finished_at is null)
    or (status in ('succeeded', 'failed') and finished_at is not null)
  )
);

create table if not exists public.monday_workspaces (
  workspace_id text primary key,
  name text not null,
  kind text not null default '',
  state text not null default '',
  description text not null default '',
  last_seen_run_id uuid references public.monday_schema_runs(id) on delete set null,
  source_active boolean not null default true,
  raw_settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.monday_boards (
  board_id text primary key,
  workspace_id text,
  name text not null,
  board_kind text not null default '',
  state text not null default '',
  url text not null default '',
  source_updated_at timestamptz,
  is_priority boolean not null default false,
  priority_reason text not null default '',
  last_seen_run_id uuid references public.monday_schema_runs(id) on delete set null,
  source_active boolean not null default true,
  raw_settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.monday_groups (
  id uuid primary key default gen_random_uuid(),
  board_id text not null,
  group_id text not null,
  title text not null,
  position text not null default '',
  archived boolean not null default false,
  last_seen_run_id uuid references public.monday_schema_runs(id) on delete set null,
  source_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(board_id, group_id)
);

create table if not exists public.monday_columns (
  id uuid primary key default gen_random_uuid(),
  board_id text not null,
  column_id text not null,
  title text not null,
  type text not null,
  description text not null default '',
  settings jsonb not null default '{}'::jsonb,
  revision text not null default '',
  archived boolean not null default false,
  semantic_hint text not null default '',
  internal_field text,
  mapping_status text not null default 'unmapped' check (mapping_status in ('confirmed','probable','ambiguous','unmapped')),
  last_seen_run_id uuid references public.monday_schema_runs(id) on delete set null,
  source_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(board_id, column_id)
);

create table if not exists public.monday_board_relations (
  id uuid primary key default gen_random_uuid(),
  source_board_id text not null,
  source_column_id text not null,
  target_board_id text not null,
  relation_type text not null,
  target_unresolved boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  last_seen_run_id uuid references public.monday_schema_runs(id) on delete set null,
  source_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(source_board_id, source_column_id, target_board_id)
);
```

Adicionar índices para `runs(started_at desc)`, `boards(is_priority, name)`, `columns(board_id, type)`, `columns(board_id, semantic_hint)`, `relations(source_board_id)`.

Adicionar triggers `app_private.set_updated_at()` nas cinco tabelas mutáveis.

- [ ] **Step 2: Adicionar RLS e grants**

Aplicar em todas as seis tabelas:

```sql
alter table public.<table> enable row level security;
alter table public.<table> force row level security;
```

Para as tabelas de catálogo, criar policy SELECT:

```sql
using (app_private.has_support_access())
```

Para `monday_schema_runs`, mesma leitura para suporte. Não criar policies de INSERT/UPDATE para authenticated.

Executar:

```sql
revoke all on table public.<table> from anon, authenticated;
grant select on table public.<table> to authenticated;
grant select, insert, update, delete on table public.<table> to service_role;
```

- [ ] **Step 3: Aplicar migration no Supabase**

Run: `Supabase.apply_migration(project_id='jauevfvafakrrrzfexyc', name='monday_schema_explorer', query=<migration>)`.

Expected: migration aplicada sem erro.

- [ ] **Step 4: Verificar schema e segurança**

Run queries:

```sql
select tablename, rowsecurity
from pg_tables
where schemaname='public'
  and tablename like 'monday_%';
```

Expected: todas as novas tabelas com `rowsecurity=true`.

Rodar advisors de segurança e garantir que nenhum alerta crítico novo foi introduzido.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260810154000_monday_schema_explorer.sql
git commit -m "feat: add Monday schema explorer database"
```

---

### Task 2: Criar domínio puro de descoberta e classificação

**Files:**
- Create: `src/lib/monday/schema-domain.ts`
- Create: `src/lib/monday/schema-domain.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces:
  - `normalizeSchemaText(value: unknown): string`
  - `parseBoardRelationTargets(column: MondaySchemaColumn): string[]`
  - `classifySemanticHint(column: MondaySchemaColumn): string`
  - `classifyPriorityBoard(board: MondaySchemaBoard, mainBoardId: string, relatedIds: Set<string>): { priority: boolean; reason: string }`
  - tipos `MondaySchemaWorkspace`, `MondaySchemaBoard`, `MondaySchemaGroup`, `MondaySchemaColumn`, `MondaySchemaRelation`.

- [ ] **Step 1: Escrever testes falhos**

Cobrir:

```ts
assert.equal(normalizeSchemaText('  Satisfação / NPS  '), 'satisfacao nps');
assert.deepEqual(
  parseBoardRelationTargets({ id:'rel', title:'Hardware Issue', type:'board_relation', settings:{ boardIds:[123, '456'] }, archived:false }),
  ['123','456'],
);
assert.equal(classifySemanticHint({ id:'tags', title:'Tags', type:'tags', settings:{}, archived:false }), 'tags');
assert.equal(classifySemanticHint({ id:'tt', title:'Controle de tempo aberto', type:'time_tracking', settings:{}, archived:false }), 'time_tracking');
assert.equal(classifySemanticHint({ id:'supplier', title:'N° do chamado Fornecedor', type:'text', settings:{}, archived:false }), 'supplier_ticket');
```

Testar board principal e board relacionado como prioritários; board sem relação/termo relevante como não prioritário.

- [ ] **Step 2: Executar teste e confirmar falha**

Run: `npm test`.

Expected: FAIL por módulo/funções inexistentes.

- [ ] **Step 3: Implementar tipos e funções puras**

Definir:

```ts
export type MondaySchemaColumn = {
  id: string;
  title: string;
  type: string;
  description?: string | null;
  settings?: Record<string, unknown> | null;
  revision?: string | null;
  archived: boolean;
};
```

`parseBoardRelationTargets()` deve aceitar `settings.boardIds` ou `settings.boardId`, converter para string, remover vazios e duplicados.

`classifySemanticHint()` deve usar primeiro `type`, depois título normalizado, retornando um destes valores quando identificável:

```text
category
tags
supplier_ticket
supplier_link
time_tracking
hardware
software
incident
satisfaction
file
board_relation
mirror
requester
email
priority
status
request_type
root_cause
unknown
```

- [ ] **Step 4: Atualizar script de testes**

Adicionar `src/lib/monday/schema-domain.test.ts` ao comando `test` de `package.json`.

- [ ] **Step 5: Rodar testes**

Run: `npm test`.

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/monday/schema-domain.ts src/lib/monday/schema-domain.test.ts package.json
git commit -m "test: define Monday schema explorer domain"
```

---

### Task 3: Consultar workspaces, boards, grupos, colunas e relações

**Files:**
- Create: `src/lib/monday/schema-client.ts`
- Test: `src/lib/monday/schema-domain.test.ts`

**Interfaces:**
- Consumes: `mondayRequest<T>(query, variables)` de `src/lib/monday/client.ts`.
- Produces:
  - `fetchMondayWorkspaces(): Promise<MondaySchemaWorkspace[]>`
  - `fetchMondayBoards(): Promise<MondaySchemaBoard[]>`
  - `fetchMondayBoardStructures(boardIds: string[]): Promise<Array<{ board: MondaySchemaBoard; groups: MondaySchemaGroup[]; columns: MondaySchemaColumn[] }>>`
  - `resolveMondayRelationTargets(columnId: string): Promise<string[]>`
  - `fetchMondaySchemaSnapshot(mainBoardId: string): Promise<MondaySchemaSnapshot>`.

- [ ] **Step 1: Implementar consulta paginada de workspaces**

GraphQL:

```graphql
query Workspaces($limit: Int!, $page: Int!) {
  workspaces(limit: $limit, page: $page) {
    id
    name
    description
    kind
    state
  }
}
```

Usar `limit=100`; incrementar `page` enquanto o retorno tiver 100 registros.

- [ ] **Step 2: Implementar consulta paginada de boards**

GraphQL:

```graphql
query Boards($limit: Int!, $page: Int!) {
  boards(limit: $limit, page: $page) {
    id
    name
    board_kind
    state
    url
    updated_at
    workspace { id }
  }
}
```

Deduplicar por `id`.

- [ ] **Step 3: Implementar consulta de estruturas em lotes**

Para lotes de no máximo 25 boards:

```graphql
query BoardStructures($boardIds: [ID!]!) {
  boards(ids: $boardIds) {
    id
    name
    board_kind
    state
    url
    updated_at
    workspace { id }
    groups { id title position archived }
    columns {
      id
      title
      type
      description
      settings
      revision
      archived
    }
  }
}
```

- [ ] **Step 4: Resolver relações de board**

Para colunas `type === 'board_relation'`:

1. usar `parseBoardRelationTargets(column)`;
2. se vazio, chamar:

```graphql
query RelationBoards($connectionId: ID!) {
  connection_board_ids(connection_id: $connectionId)
}
```

Nunca chamar `connection_board_ids` para tipos diferentes de `board_relation`.

- [ ] **Step 5: Montar snapshot completo**

Definir:

```ts
export type MondaySchemaSnapshot = {
  workspaces: MondaySchemaWorkspace[];
  boards: MondaySchemaBoard[];
  groups: MondaySchemaGroup[];
  columns: MondaySchemaColumnRecord[];
  relations: MondaySchemaRelation[];
};
```

`MondaySchemaColumnRecord` deve incluir `boardId`.

Marcar boards prioritários após relações serem conhecidas.

- [ ] **Step 6: Verificação TypeScript**

Run: `npm run typecheck`.

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/monday/schema-client.ts src/lib/monday/schema-domain.ts
 git commit -m "feat: discover Monday account schema"
```

---

### Task 4: Persistir snapshot com reconciliação segura

**Files:**
- Create: `src/lib/monday/schema-sync.ts`

**Interfaces:**
- Consumes: `fetchMondaySchemaSnapshot(mainBoardId)` e `createAdminClient()`/cliente Supabase de serviço usado nas integrações atuais.
- Produces:
  - `runMondaySchemaSync(input: { triggerSource: 'manual' | 'cron'; triggeredBy?: string | null }): Promise<MondaySchemaSyncResult>`.

- [ ] **Step 1: Criar execução `running`**

Inserir em `monday_schema_runs` antes de chamar a API.

- [ ] **Step 2: Obter snapshot completo**

Ler `boardId` com `readMondayEnv()` e executar `fetchMondaySchemaSnapshot(boardId)`.

- [ ] **Step 3: Upsert workspaces, boards, grupos e colunas**

Usar `last_seen_run_id = runId` em todos os upserts.

Para colunas, persistir:

```ts
{
  board_id,
  column_id,
  title,
  type,
  description,
  settings,
  revision,
  archived,
  semantic_hint,
  last_seen_run_id,
  source_active: true,
}
```

Não sobrescrever manualmente `internal_field`/`mapping_status='confirmed'` durante descoberta. Ao fazer upsert, preservar confirmação existente; atualizar `semantic_hint`, título, tipo e settings.

- [ ] **Step 4: Upsert relações**

Persistir `(source_board_id, source_column_id, target_board_id)` e marcar `target_unresolved` quando `target_board_id` não estiver na lista de boards acessíveis.

- [ ] **Step 5: Desativar ausentes somente após todos os upserts**

Somente depois de snapshot e upserts completos:

```text
monday_workspaces: source_active=false where last_seen_run_id <> runId
monday_boards: source_active=false where last_seen_run_id <> runId
monday_groups: source_active=false where last_seen_run_id <> runId
monday_columns: source_active=false where last_seen_run_id <> runId
monday_board_relations: source_active=false where last_seen_run_id <> runId
```

Não excluir registros.

- [ ] **Step 6: Finalizar execução com sucesso**

Atualizar contagens reais, `status='succeeded'`, `finished_at=now()`.

- [ ] **Step 7: Preservar snapshot em falha**

Em `catch`, atualizar somente `monday_schema_runs`:

```ts
status: 'failed'
finished_at: now
error_summary: sanitizado e <= 1000 caracteres
```

Não executar nenhuma desativação.

- [ ] **Step 8: Verificação**

Run: `npm run typecheck`.

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/lib/monday/schema-sync.ts
git commit -m "feat: persist Monday schema snapshots safely"
```

---

### Task 5: Criar refresh manual e cron diário

**Files:**
- Create: `src/app/api/admin/integrations/monday/schema/refresh/route.ts`
- Create: `src/app/api/cron/monday-schema/route.ts`
- Modify: `vercel.json`

**Interfaces:**
- Consumes: `runMondaySchemaSync()`.
- Produces: endpoints de execução manual e cron.

- [ ] **Step 1: Implementar endpoint admin**

Usar padrão de `src/app/api/admin/integrations/monday/sync/route.ts`:

```ts
const authorization = await authorizeAdminApi();
if (!authorization.ok) return authorization.response;
const result = await runMondaySchemaSync({
  triggerSource: 'manual',
  triggeredBy: authorization.actor.userId,
});
```

Resposta de sucesso:

```json
{
  "ok": true,
  "runId": "...",
  "summary": {
    "workspaces": 0,
    "boards": 0,
    "groups": 0,
    "columns": 0,
    "relations": 0
  }
}
```

Não retornar stack trace ou mensagem crua da API ao cliente.

- [ ] **Step 2: Implementar cron protegido**

Seguir padrão dos outros endpoints de cron: validar `CRON_SECRET` com comparação constante e chamar:

```ts
runMondaySchemaSync({ triggerSource: 'cron', triggeredBy: null })
```

- [ ] **Step 3: Agendar cron**

Adicionar a `vercel.json`:

```json
{ "path": "/api/cron/monday-schema", "schedule": "0 9 * * *" }
```

Preservar os quatro crons já existentes.

- [ ] **Step 4: Build**

Run: `npm run typecheck && npm run build`.

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/admin/integrations/monday/schema/refresh/route.ts src/app/api/cron/monday-schema/route.ts vercel.json
git commit -m "feat: schedule Monday schema discovery"
```

---

### Task 6: Criar referência Excel × Monday × Supabase

**Files:**
- Create: `src/lib/monday/executive-field-map.ts`
- Create: `src/lib/monday/executive-field-map.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces:
  - `EXECUTIVE_EXCEL_FIELDS`
  - `KNOWN_HELPDESK_MONDAY_FIELDS`
  - `buildExecutiveFieldMap(columns): ExecutiveFieldMapping[]`.

- [ ] **Step 1: Codificar os 36 cabeçalhos reais do Excel**

Usar exatamente, na ordem da linha 3 de `tickets!A3:AJ3`:

```ts
export const EXECUTIVE_EXCEL_FIELDS = [
  'Nome',
  'Subelementos',
  'Descrição',
  'Link dos chamados',
  'N° do chamado Fornecedor',
  'Atualização do chamado',
  'Arquivos para atualizar chamado',
  'Nome do Funcionário',
  'Responsavel',
  'Status',
  'Prioridade',
  'Tipo de solicitação',
  'Resposta do Usuário ao chamado',
  'Data de criação',
  'Arquivo para incidentes',
  'Justificativa da Prioridade',
  'E-mail',
  'Category',
  'Incidentes',
  'Atualização do chamado',
  'Data de resolução',
  'Controle de tempo Tickets criado',
  'Controle de tempo tickets aberto',
  'Causa Raiz',
  'Tags',
  'Texto',
  'Arquivo para requisição de serviço',
  'Dup. of Preencha o documento para requisição de serviços',
  'Responsável',
  'Hardware Issue',
  'Software Service Issue',
  'monday Doc',
  'Arquivo',
  'Seleção individual',
  'Nome do funcionário',
  'Item ID (auto generated)',
] as const;
```

- [ ] **Step 2: Registrar IDs já confirmados no Helpdesk**

```ts
export const KNOWN_HELPDESK_MONDAY_FIELDS = {
  email: 'email',
  openedAt: 'date',
  resolvedAt: 'date6',
  description: 'long_text7',
  responsible: 'people0',
  status: 'status95',
  priority: 'priority',
  priorityJustification: 'long_textzr7lt7g8',
  requestType: 'request_type',
  rootCause: 'long_text_mkx84r4n',
  currentUpdate: 'text_mm0qa8s9',
  requesterName: 'dropdown_mky7rgr1',
  legacyFiles: 'file_mm12mh4c',
  userReply: 'long_text_mm12wpxe',
  userFiles: 'file4t50hmgx',
} as const;
```

- [ ] **Step 3: Implementar `buildExecutiveFieldMap`**

Regra de status:

- ID já conhecido e coluna encontrada → `confirmed`.
- título normalizado único + semantic_hint compatível → `probable`.
- mais de uma candidata → `ambiguous`.
- nenhuma candidata → `unmapped`.

Nunca converter `probable` em ID operacional automaticamente.

- [ ] **Step 4: Testar referência e ambiguidades**

Testes obrigatórios:

```ts
assert.equal(EXECUTIVE_EXCEL_FIELDS.length, 36);
assert.equal(KNOWN_HELPDESK_MONDAY_FIELDS.requesterName, 'dropdown_mky7rgr1');
```

Criar fixture com duas colunas chamadas `Atualização do chamado` e verificar `ambiguous` quando não houver ID confirmado.

Criar fixture com `Category` único e verificar `probable`.

- [ ] **Step 5: Adicionar teste ao package.json e rodar**

Run: `npm test`.

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/monday/executive-field-map.ts src/lib/monday/executive-field-map.test.ts package.json
git commit -m "feat: map executive Excel fields to Monday schema"
```

---

### Task 7: Criar query server-side e página administrativa

**Files:**
- Create: `src/lib/monday/schema-query.ts`
- Create: `src/components/monday-schema-refresh-button.tsx`
- Create: `src/app/admin/integrations/monday/schema/page.tsx`
- Modify: `src/app/admin/integrations/monday/page.tsx`

**Interfaces:**
- Consumes: catálogo Supabase e `buildExecutiveFieldMap()`.
- Produces: `getMondaySchemaOverview()` e UI restrita a suporte.

- [ ] **Step 1: Implementar query de overview**

Retornar:

```ts
export type MondaySchemaOverview = {
  latestRun: null | {
    id: string;
    status: 'running' | 'succeeded' | 'failed';
    startedAt: string;
    finishedAt: string | null;
    errorSummary: string | null;
  };
  counts: {
    workspaces: number;
    boards: number;
    priorityBoards: number;
    groups: number;
    columns: number;
    relations: number;
  };
  boards: Array<{
    id: string;
    name: string;
    workspaceId: string | null;
    kind: string;
    state: string;
    url: string;
    isPriority: boolean;
    priorityReason: string;
    relationCount: number;
  }>;
  columns: Array<{
    boardId: string;
    id: string;
    title: string;
    type: string;
    semanticHint: string;
    internalField: string | null;
    mappingStatus: string;
    settings: Record<string, unknown>;
  }>;
  executiveMap: ExecutiveFieldMapping[];
};
```

Usar cliente Supabase autenticado; RLS garante acesso apenas a suporte.

- [ ] **Step 2: Criar botão client-side de refresh**

POST em `/api/admin/integrations/monday/schema/refresh`.

Mostrar `Atualizando estrutura…`, resultado e `router.refresh()` em sucesso.

Para `ti_agent`, não renderizar o botão. Receber prop `canRefresh: boolean` da página.

- [ ] **Step 3: Criar página `/admin/integrations/monday/schema`**

Começar com:

```ts
const { profile } = await requireSupport();
const overview = await getMondaySchemaOverview();
```

Seções:

1. Cabeçalho `Estrutura do Monday` + última execução.
2. KPIs: workspaces, boards, prioritários, colunas, relações.
3. Inventário de boards.
4. Colunas do board principal `18389222247`.
5. Relações/boards conectados.
6. `Mapa Executivo` com `campo Excel`, `status`, `ID`, `tipo`, `campo interno`.

Usar classes globais já existentes (`panel`, `metrics-grid`, `admin-table`, `tag`). Não introduzir biblioteca de UI.

- [ ] **Step 4: Linkar Explorer na página de integração**

Adicionar botão/link:

```tsx
<Link className="button button--ghost" href="/admin/integrations/monday/schema">
  Explorar estrutura do Monday
</Link>
```

- [ ] **Step 5: Build e lint**

Run: `npm run lint && npm run typecheck && npm run build`.

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/monday/schema-query.ts src/components/monday-schema-refresh-button.tsx src/app/admin/integrations/monday/schema/page.tsx src/app/admin/integrations/monday/page.tsx
git commit -m "feat: add Monday schema explorer admin UI"
```

---

### Task 8: Executar primeira descoberta e homologar o mapa real

**Files:**
- Modify: `src/lib/monday/executive-field-map.ts` somente para confirmações sustentadas pela API.
- Modify: `README.md`

**Interfaces:**
- Consumes: Explorer publicado em Preview com envs existentes.
- Produces: inventário real e mapa inicial confirmado.

- [ ] **Step 1: Abrir PR da branch**

Criar PR `feat: explorar estrutura do Monday` para `main` em modo draft.

- [ ] **Step 2: Aguardar CI e Preview**

Verificar:

```text
npm test
npm run lint
npm run typecheck
npm run build
Vercel Preview READY
```

- [ ] **Step 3: Executar refresh no Preview com conta admin**

Acessar `/admin/integrations/monday/schema` e usar `Atualizar estrutura agora`.

Expected: execução `succeeded`; board `18389222247` presente; número de colunas > 0.

- [ ] **Step 4: Conferir banco**

Consultas:

```sql
select board_id, name, is_priority, priority_reason
from public.monday_boards
where source_active = true
order by is_priority desc, name;

select board_id, column_id, title, type, semantic_hint, settings
from public.monday_columns
where source_active = true
  and board_id = '18389222247'
order by title;

select *
from public.monday_board_relations
where source_active = true
order by source_board_id, source_column_id, target_board_id;
```

- [ ] **Step 5: Confirmar IDs do mapa executivo**

Comparar colunas do board com os 36 cabeçalhos do Excel. Atualizar `KNOWN_HELPDESK_MONDAY_FIELDS`/mapa somente quando ID + tipo + título/semântica forem inequívocos.

Campos prioritários para confirmar:

```text
Category
Tags
N° do chamado Fornecedor
Link dos chamados
Controle de tempo Tickets criado
Controle de tempo tickets aberto
Hardware Issue
Software Service Issue
Incidentes
Seleção individual
```

- [ ] **Step 6: Documentar resultado**

Adicionar ao README seção `Monday Schema Explorer` com:

- rota administrativa;
- cron 06:00 BRT;
- última estrutura fica no Supabase;
- Excel é fonte de homologação, não fonte operacional;
- Painel Executivo será construído após confirmação dos IDs.

- [ ] **Step 7: Rodar verificação final**

Run:

```text
npm run quality
```

Expected: todos os testes, lint, typecheck e build PASS.

Verificar Supabase security advisors sem novo alerta crítico.

- [ ] **Step 8: Tirar PR de draft e solicitar revisão**

Não mesclar antes de confirmar que o inventário real foi populado e que requester continua sem acesso à rota/tabelas.

- [ ] **Step 9: Commit final da homologação**

```bash
git add src/lib/monday/executive-field-map.ts README.md
git commit -m "docs: confirm Monday schema inventory"
```

---

## Final Acceptance Checklist

- [ ] `18389222247` aparece no catálogo com grupos e colunas atuais.
- [ ] `settings` é persistido como JSONB sem `settings_str` novo.
- [ ] Relações `board_relation` resolvem target boards por `settings.boardIds` ou `connection_board_ids(connection_id)`.
- [ ] Requester recebe bloqueio ao acessar a página e não lê tabelas via RLS.
- [ ] `ti_agent` lê inventário, mas não consegue executar refresh manual.
- [ ] Admin lê e executa refresh manual.
- [ ] Cron diário 09:00 UTC está configurado.
- [ ] Falha de descoberta não desativa o snapshot anterior.
- [ ] Os 36 cabeçalhos do Excel estão representados no mapa.
- [ ] IDs atuais já conhecidos continuam confirmados.
- [ ] Category, Tags, fornecedor, time tracking e boards relacionados ficam destacados até confirmação real.
- [ ] Nenhum secret aparece em UI, DB ou logs.
- [ ] `npm run quality` passa.
- [ ] Vercel Preview fica `READY`.
- [ ] Security advisors do Supabase continuam sem alerta crítico novo.
