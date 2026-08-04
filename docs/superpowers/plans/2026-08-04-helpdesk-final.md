# CAF TI Helpdesk Final Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Entregar o Helpdesk completo em Next.js, Supabase e Vercel, sem dependência operacional de Google Apps Script, Google Sheets ou Google Drive.

**Architecture:** Supabase PostgreSQL é a fonte de verdade do portal. O Monday é uma integração bidirecional resiliente: sincronização completa, webhooks incrementais e fila de pendências. Escritas do usuário são persistidas primeiro no Supabase e depois replicadas para o Monday, preservando dados mesmo quando a integração externa falha.

**Tech Stack:** Next.js 16, React 19, TypeScript 6, Supabase Auth/PostgreSQL/Storage, Monday GraphQL API 2026-07, Vercel Cron, PowerShell.

## Global Constraints

- Não usar Google Apps Script, Google Sheets ou Google Drive no fluxo final.
- Nenhuma credencial no código ou no pacote.
- Usuários comuns veem apenas chamados próprios; TI e administradores veem a operação autorizada.
- Prioridades Crítica e Alta exigem justificativa.
- Comentários e anexos são salvos no Supabase antes da tentativa de replicação para o Monday.
- O pacote final exclui `.env`, `.env.local`, `.git`, `.next`, `node_modules` e `.vercel`.

---

### Task 1: Domínio e validações
- [x] Criar testes de validação, SLA, payload Monday e webhooks.
- [x] Implementar funções puras e executar testes.

### Task 2: Schema final
- [x] Criar migration de comentários, storage, auditoria, webhooks, SLA e origem do chamado.
- [x] Aplicar RLS e grants mínimos.

### Task 3: Leitura e dashboards
- [x] Criar consultas de chamados, detalhes, filtros e KPIs.
- [x] Criar telas Meus Chamados, detalhe, dashboard e gerenciamento.

### Task 4: Escrita resiliente
- [x] Criar chamado nativo, comentários e anexos no Supabase.
- [x] Replicar no Monday e registrar pendências sem perder dados.

### Task 5: Webhooks e reconciliação
- [x] Criar endpoint com challenge, segredo e deduplicação.
- [x] Processar item único, exclusões e arquivamentos.
- [x] Manter cron de reconciliação completa.

### Task 6: Administração e corte
- [x] Criar auditoria, painel de pendências e health checks.
- [x] Atualizar scripts, documentação, pacote e validações.
