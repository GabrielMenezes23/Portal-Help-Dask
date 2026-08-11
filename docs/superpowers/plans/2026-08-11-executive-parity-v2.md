# Executive Panel Parity V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore feature parity with the legacy static executive ticket portal inside the live TI-only Helpdesk dashboard.

**Architecture:** Keep Supabase as the only dashboard data source. Extend pure executive analytics with deterministic backlog, performance, origin and briefing calculations; keep the authenticated page server-rendered; add narrowly scoped client components only for CSV export and ticket details.

**Tech Stack:** Next.js 16.2.12, React 19.2.8, TypeScript 6.0.3, Supabase, Node test runner.

## Global Constraints
- Keep `/admin/executive` protected by `requireSupport()`.
- Do not restore embedded static snapshots.
- Do not invent NPS without a real satisfaction source.
- Preserve existing Monday synchronization architecture.
- Keep current eight top-level executive sections.
- All new calculations must be deterministic and testable.

---

### Task 1: Executive analytics primitives

**Files:**
- Modify: `src/lib/executive/analytics.ts`
- Modify: `src/lib/executive/analytics.test.ts`

**Interfaces:**
- Produces `isDependencyStatus(status: string): boolean`
- Produces `ticketAgeDays(openedAt: string | null, now?: Date): number | null`
- Produces grouped resolution statistics usable by query aggregation.

- [ ] **Step 1: Write failing tests** for blocking/waiting status detection and stable ticket age.
- [ ] **Step 2: Run `npm test`** and confirm the new tests fail.
- [ ] **Step 3: Implement minimal deterministic helpers** without adding runtime dependencies.
- [ ] **Step 4: Run `npm test`** and confirm the helpers pass.
- [ ] **Step 5: Commit** `feat: add executive backlog analytics`.

### Task 2: Rich dashboard aggregation

**Files:**
- Modify: `src/lib/executive/query.ts`
- Modify: `src/lib/executive/analytics.test.ts`

**Interfaces:**
- Extends `ExecutiveDashboard` with `backlog`, `performanceByType`, `performanceByResponsible`, `cycleDistribution`, `prioritySituation`, `attention`, `originDetails`, and `briefing`.

- [ ] **Step 1: Add failing tests** using `buildExecutiveDashboardForTest()` for grouped performance, attention ranking and origin splits.
- [ ] **Step 2: Run `npm test`** and confirm failures.
- [ ] **Step 3: Implement aggregation functions** using the already loaded ticket universe.
- [ ] **Step 4: Ensure backlog-by-responsible uses only active tickets**, not all tickets.
- [ ] **Step 5: Generate deterministic briefing bullets** from aggregates only.
- [ ] **Step 6: Run `npm test`** and confirm pass.
- [ ] **Step 7: Commit** `feat: restore executive dashboard analytics`.

### Task 3: CSV export and ticket detail drawer

**Files:**
- Create: `src/app/admin/executive/executive-client.tsx`
- Modify: `src/app/admin/executive/executive.module.css`

**Interfaces:**
- Produces `ExecutiveCsvButton` receiving serialized filtered tickets.
- Produces `TicketDetailButton` / drawer receiving one serialized ticket.

- [ ] **Step 1: Implement CSV export** with UTF-8 BOM and semicolon delimiter for Excel compatibility in pt-BR.
- [ ] **Step 2: Implement accessible drawer** with close button, backdrop and keyboard Escape handling.
- [ ] **Step 3: Render all structured ticket fields already available from Supabase.**
- [ ] **Step 4: Add responsive drawer/table styles.**
- [ ] **Step 5: Commit** `feat: add executive export and ticket details`.

### Task 4: Restore legacy analytical views

**Files:**
- Modify: `src/app/admin/executive/page.tsx`
- Modify: `src/app/admin/executive/executive.module.css`

**Interfaces:**
- Consumes the extended `ExecutiveDashboard` and client components.

- [ ] **Step 1: Visão Geral** — add executive briefing and attention queue.
- [ ] **Step 2: Backlog** — add dependency/status distribution, active backlog by responsible, age and dependency columns.
- [ ] **Step 3: Performance** — add cycle distribution, priority x situation, performance by type and responsible.
- [ ] **Step 4: Demanda** — add type, priority, root cause and recurring-demand insights.
- [ ] **Step 5: Origem** — add `Resumo`, `Abertos pela TI`, `% de aberturas`, `Abertos pelos usuários` internal navigation and detail tables.
- [ ] **Step 6: Satisfação** — add `NPS Geral` and `NPS Mensal` internal navigation with truthful no-source states.
- [ ] **Step 7: Base** — render complete filtered universe with CSV and detail drawer.
- [ ] **Step 8: Qualidade** — expand completeness cards and integrity warnings.
- [ ] **Step 9: Commit** `feat: complete executive portal parity`.

### Task 5: Quality gate and preview

**Files:**
- Modify only files required by failures discovered during verification.

**Interfaces:**
- Produces a branch ready for PR review.

- [ ] **Step 1: Run `npm run quality`.**
- [ ] **Step 2: Fix only failures caused by this branch and rerun until green.**
- [ ] **Step 3: Open/update PR from `feat/executive-parity-v2` to `main`.**
- [ ] **Step 4: Verify GitHub Actions for the final head SHA.**
- [ ] **Step 5: Leave merge pending final visual/user homologation.**
