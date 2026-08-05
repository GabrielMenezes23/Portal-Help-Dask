# Monday Bidirectional Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sincronizar responsável, chamados, comentários e anexos entre Portal CAF TI e Monday nos dois sentidos, mantendo o Supabase como registro principal das ações do portal e preservando o isolamento por usuário Microsoft.

**Architecture:** A integração reutiliza o cliente GraphQL e os webhooks existentes. Opções do dropdown são armazenadas no Supabase; eventos do Monday atualizam tickets, Updates e assets de forma idempotente; operações do portal são persistidas primeiro e enviadas ao Monday com marcadores de deduplicação e reprocessamento.

**Tech Stack:** Next.js 16, React 19, TypeScript 6, Supabase PostgreSQL/Storage/Auth, Monday GraphQL API 2026-07, Vercel Cron e Webhooks.

## Global Constraints

- Board: `18389222247`.
- Coluna do responsável pela abertura: `dropdown_mky7rgr1`.
- Sincronização diária da lista às 05:00 em `America/Sao_Paulo` (`08:00 UTC`).
- O responsável selecionado não altera `requester_user_id` nem `requester_email`.
- Nenhum segredo pode ser exposto ao cliente ou aos logs.
- RLS deve permanecer habilitado em todas as tabelas públicas.
- O portal deve continuar funcionando quando o Monday estiver indisponível.
- Upload do portal permanece limitado a 8 MB.
- Toda escrita deve ser idempotente e tolerante a repetição de webhook.

---

### Task 1: Migration e modelo de dados

**Files:**
- Create: `supabase/migrations/20260805150000_monday_bidirectional_sync.sql`
- Test: validações SQL via Supabase advisors e consultas de schema.

**Interfaces:**
- Produces: tabela `monday_dropdown_options`; colunas `tickets.opening_responsible_option_id`, `tickets.opening_responsible_name`; colunas de origem Monday em `ticket_comments`.

- [ ] **Step 1: Escrever a migration**

Criar tabela com unicidade por board/coluna/opção, índices de busca por label normalizado, RLS e policy de leitura para usuários ativos. Adicionar colunas aos tickets e comentários, além de índice único parcial para `monday_update_id`.

- [ ] **Step 2: Aplicar a migration no projeto Supabase**

Run: `Supabase.apply_migration` no projeto `jauevfvafakrrrzfexyc`.
Expected: migration aplicada sem erro.

- [ ] **Step 3: Verificar schema e advisors**

Run: listar tabelas e executar advisors de segurança e performance.
Expected: RLS ativo, sem alerta crítico novo.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260805150000_monday_bidirectional_sync.sql
git commit -m "feat: add Monday bidirectional sync schema"
```

### Task 2: Domínio e validação do responsável

**Files:**
- Create: `src/lib/monday/dropdown-options.ts`
- Create: `src/lib/monday/dropdown-options.test.ts`
- Modify: `src/lib/tickets/validation.ts`
- Modify: `src/lib/tickets/validation.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `normalizeDropdownLabel(value: string): string`, `matchOpeningResponsible(options, requesterName)`, validação de `openingResponsibleOptionId` e `openingResponsibleName`.

- [ ] **Step 1: Escrever testes falhos**

Cobrir normalização de acentos, múltiplos espaços, correspondência exata, ausência de correspondência e rejeição de responsável vazio.

- [ ] **Step 2: Executar testes e confirmar falha**

Run: `npm test`.
Expected: FAIL por funções/campos ausentes.

- [ ] **Step 3: Implementar funções puras e tipos**

Adicionar helpers sem dependência de servidor para facilitar teste unitário.

- [ ] **Step 4: Atualizar validação de ticket**

`NewTicketInput` e `ValidNewTicket` recebem `openingResponsibleOptionId` e `openingResponsibleName`; ambos obrigatórios.

- [ ] **Step 5: Executar testes**

Run: `npm test`.
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/monday/dropdown-options.ts src/lib/monday/dropdown-options.test.ts src/lib/tickets/validation.ts src/lib/tickets/validation.test.ts package.json
git commit -m "test: define opening responsible rules"
```

### Task 3: Sincronização diária das opções do dropdown

**Files:**
- Create: `src/lib/monday/dropdown-sync.ts`
- Create: `src/lib/monday/dropdown-sync.test.ts`
- Create: `src/app/api/cron/monday-dropdown-options/route.ts`
- Modify: `src/lib/monday/client.ts`
- Modify: `src/lib/monday/domain.ts`
- Modify: `vercel.json`
- Modify: `package.json`

**Interfaces:**
- Consumes: `mondayRequest`, `normalizeDropdownLabel`.
- Produces: `fetchMondayDropdownOptions(boardId, columnId)`, `syncOpeningResponsibleOptions()`.

- [ ] **Step 1: Escrever testes falhos para parsing e reconciliação**

Cobrir labels recebidos em `settings_str`, IDs estáveis, deduplicação e regra de não desativar opções quando a consulta falha.

- [ ] **Step 2: Implementar consulta de coluna**

GraphQL consulta `boards(ids){ columns(ids:[...]) { id title type settings_str } }` e extrai labels do dropdown.

- [ ] **Step 3: Implementar persistência transacional segura**

Upsert das opções recebidas; somente após sucesso desativar opções ausentes da mesma combinação board/coluna.

- [ ] **Step 4: Criar cron protegido**

Endpoint valida `CRON_SECRET` com comparação constante e retorna contagens.

- [ ] **Step 5: Agendar 08:00 UTC**

Adicionar `{ "path": "/api/cron/monday-dropdown-options", "schedule": "0 8 * * *" }`.

- [ ] **Step 6: Executar testes**

Run: `npm test && npm run typecheck`.
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/monday/dropdown-sync.ts src/lib/monday/dropdown-sync.test.ts src/app/api/cron/monday-dropdown-options/route.ts src/lib/monday/client.ts src/lib/monday/domain.ts vercel.json package.json
git commit -m "feat: sync Monday opening responsible options"
```

### Task 4: Campo pesquisável no formulário

**Files:**
- Create: `src/lib/monday/dropdown-query.ts`
- Modify: `src/app/app/tickets/new/page.tsx`
- Modify: `src/components/new-ticket-form.tsx`
- Modify: `src/components/new-ticket-form.module.css`

**Interfaces:**
- Consumes: opções ativas do Supabase e `matchOpeningResponsible`.
- Produces: seletor obrigatório com `openingResponsibleOptionId` e `openingResponsibleName` no FormData.

- [ ] **Step 1: Criar consulta server-side de opções ativas**

Ordenar por `option_label`, limitar a 500 e retornar somente ID/label.

- [ ] **Step 2: Passar opções e pré-seleção para o componente**

A página calcula correspondência exata usando o nome do profile.

- [ ] **Step 3: Implementar combobox acessível**

Usar input de busca + select/listbox nativo controlado, sem biblioteca nova. Campo obrigatório e mensagem clara quando lista estiver vazia.

- [ ] **Step 4: Preservar identidade autenticada**

Não enviar nem aceitar `requester_user_id` ou e-mail controlados pelo cliente.

- [ ] **Step 5: Executar lint/typecheck/build**

Run: `npm run lint && npm run typecheck && npm run build`.
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/monday/dropdown-query.ts src/app/app/tickets/new/page.tsx src/components/new-ticket-form.tsx src/components/new-ticket-form.module.css
git commit -m "feat: select opening responsible from Monday options"
```

### Task 5: Persistir e enviar responsável ao Monday

**Files:**
- Modify: `src/app/api/tickets/route.ts`
- Modify: `src/lib/tickets/service.ts`
- Modify: `src/lib/monday/write-model.ts`
- Modify: `src/lib/monday/write-model.test.ts`

**Interfaces:**
- Consumes: opção ativa validada no Supabase.
- Produces: ticket com campos de responsável e payload Monday para `dropdown_mky7rgr1`.

- [ ] **Step 1: Escrever teste falho do write model**

Esperar `dropdown_mky7rgr1: { labels: [nome] }` nos valores de criação.

- [ ] **Step 2: Validar opção no servidor**

Antes da criação, consultar `monday_dropdown_options` por board, coluna, option_id, label e `is_active=true`. Rejeitar valores adulterados.

- [ ] **Step 3: Persistir campos no ticket**

Salvar option ID e nome escolhidos.

- [ ] **Step 4: Enviar dropdown na criação e reprocessamento**

Incluir os campos em todas as seleções usadas por `retryPendingMondaySync`.

- [ ] **Step 5: Executar testes**

Run: `npm test && npm run typecheck`.
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/tickets/route.ts src/lib/tickets/service.ts src/lib/monday/write-model.ts src/lib/monday/write-model.test.ts
git commit -m "feat: persist opening responsible in Portal and Monday"
```

### Task 6: Updates do Monday como comentários bidirecionais

**Files:**
- Create: `src/lib/monday/updates.ts`
- Create: `src/lib/monday/updates.test.ts`
- Modify: `src/lib/monday/client.ts`
- Modify: `src/lib/monday/webhook-service.ts`
- Modify: `src/lib/tickets/service.ts`
- Modify: `src/lib/tickets/query.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `fetchMondayItemUpdates(itemId)`, `createMondayUpdate(input)`, `persistMondayUpdates(ticketId, updates)`.

- [ ] **Step 1: Escrever testes falhos de deduplicação**

Cobrir update novo, edição, exclusão lógica e marcador de comentário originado no portal.

- [ ] **Step 2: Implementar leitura de Updates**

Consultar `items(ids){ updates(limit:100){ id text_body body created_at updated_at creator{id name} assets{...} } }`.

- [ ] **Step 3: Implementar criação de Update**

Usar `create_update` e inserir marcador invisível/textual `[CAF-COMMENT:<uuid>]` para idempotência.

- [ ] **Step 4: Trocar comentário Portal → Monday**

Persistir primeiro no Supabase e criar Update. Manter reprocessamento de pendências.

- [ ] **Step 5: Persistir Monday → Portal**

Upsert por `ticket_id,monday_update_id`; `source='monday'`; autor e timestamps preservados.

- [ ] **Step 6: Integrar ao webhook**

Eventos de update buscam snapshot do item e Updates; eventos de item continuam atualizando os campos.

- [ ] **Step 7: Executar testes**

Run: `npm test && npm run typecheck`.
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/lib/monday/updates.ts src/lib/monday/updates.test.ts src/lib/monday/client.ts src/lib/monday/webhook-service.ts src/lib/tickets/service.ts src/lib/tickets/query.ts package.json
git commit -m "feat: synchronize Monday updates as ticket comments"
```

### Task 7: Anexos de Updates e colunas nos dois sentidos

**Files:**
- Modify: `src/lib/monday/client.ts`
- Modify: `src/lib/monday/updates.ts`
- Modify: `src/lib/monday/repository.ts`
- Modify: `src/lib/tickets/service.ts`

**Interfaces:**
- Produces: upload para Update quando houver `monday_update_id`, fallback para coluna de arquivo, persistência deduplicada por asset ID.

- [ ] **Step 1: Adicionar assets aos modelos de Update**

Mapear ID, nome, tamanho, tipo, URL temporária e data.

- [ ] **Step 2: Implementar `add_file_to_update`**

Enviar multipart para `/v2/file` após criar o Update do comentário.

- [ ] **Step 3: Persistir assets de Updates**

Upsert em `ticket_attachments`, associando `comment_id` quando o Update tiver comentário correspondente.

- [ ] **Step 4: Evitar duplicidade entre coluna e Update**

Conflito por `ticket_id,monday_asset_id`; atualizar origem e associação em vez de inserir novamente.

- [ ] **Step 5: Executar quality checks**

Run: `npm test && npm run lint && npm run typecheck && npm run build`.
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/monday/client.ts src/lib/monday/updates.ts src/lib/monday/repository.ts src/lib/tickets/service.ts
git commit -m "feat: synchronize Monday update attachments"
```

### Task 8: Configuração e reconciliação dos webhooks

**Files:**
- Create: `src/lib/monday/webhook-registration.ts`
- Create: `src/app/api/cron/monday-webhook-reconcile/route.ts`
- Modify: `scripts/configure-monday-webhooks.ps1`
- Modify: `docs/MONDAY_WEBHOOK_SETUP.md`
- Modify: `vercel.json`

**Interfaces:**
- Produces: reconciliação idempotente dos eventos requeridos e relatório de eventos ausentes.

- [ ] **Step 1: Consultar webhooks existentes**

Usar query `webhooks(board_id)`.

- [ ] **Step 2: Criar somente eventos ausentes**

Registrar os nove eventos definidos na especificação, sem duplicar subscriptions.

- [ ] **Step 3: Criar endpoint de reconciliação protegido**

Executar diariamente após o sync de opções e retornar criados/existentes.

- [ ] **Step 4: Atualizar documentação**

Documentar URL, segredo, scopes `webhooks:read`, `webhooks:write`, `updates:read`, `updates:write`, `assets:read`.

- [ ] **Step 5: Executar typecheck/build**

Run: `npm run typecheck && npm run build`.
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/monday/webhook-registration.ts src/app/api/cron/monday-webhook-reconcile/route.ts scripts/configure-monday-webhooks.ps1 docs/MONDAY_WEBHOOK_SETUP.md vercel.json
git commit -m "feat: reconcile Monday webhook subscriptions"
```

### Task 9: Homologação, primeira sincronização e publicação

**Files:**
- Modify: `README.md`
- Modify: `docs/FINAL_HOMOLOGATION.md`

**Interfaces:**
- Produces: release validada e roteiro de teste ponta a ponta.

- [ ] **Step 1: Executar suíte completa**

Run: `npm run quality`.
Expected: todos os testes, lint, typecheck e build passam.

- [ ] **Step 2: Abrir PR e aguardar CI/Vercel Preview**

Expected: GitHub Actions e Vercel em sucesso.

- [ ] **Step 3: Aplicar migration e executar sincronização inicial**

Executar endpoint de opções e reconciliação de webhooks com credenciais de servidor, sem expor secrets.

- [ ] **Step 4: Teste ponta a ponta**

- Portal cria item no Monday com responsável correto.
- Forms cria item e webhook o traz ao portal.
- Comentário e anexo do portal aparecem no Monday.
- Update e anexo do Monday aparecem no portal.
- Repetir webhook não duplica registros.

- [ ] **Step 5: Verificar logs e advisors**

Expected: sem erros novos de runtime, segurança ou RLS.

- [ ] **Step 6: Merge e verificar produção**

Expected: deployment `READY`, `/login` 200 e rotas protegidas sem erros.

- [ ] **Step 7: Commit documental final**

```bash
git add README.md docs/FINAL_HOMOLOGATION.md
git commit -m "docs: document bidirectional Monday integration"
```
