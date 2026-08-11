# Executive Panel Parity V2 Design

## Goal
Rebuild, inside the authenticated Helpdesk, every executive view and indicator that existed in the legacy static ticket portal, while keeping the new architecture live, TI-only, and based on Supabase/Monday data rather than embedded HTML snapshots.

## Scope
The executive panel remains under `/admin/executive` and keeps the top-level sections `Visão Geral`, `Backlog`, `Performance`, `Demanda`, `Origem`, `Satisfação`, `Base`, and `Qualidade`.

### Visão Geral
Add the legacy executive decision layer: automatic executive briefing, attention queue prioritized by critical/high priority, dependency/waiting status, and age, plus the existing volume, backlog, resolution, origin, categories, priorities, tags, and resolution performance indicators.

### Backlog
Keep aging and oldest tickets, add status/dependency distribution, true backlog by responsible, and a full filtered backlog table with ticket age and dependency classification.

### Performance
Keep same-day, <=3-day, median, average, P90 and time tracking. Add cycle-time distribution, priority x situation matrix, performance by request type, and performance by responsible with resolved volume, backlog, same-day percentage, median and average where applicable.

### Demanda
Keep categories, tags/systems and requesters. Add priority distribution, request type distribution, root-cause concentration, and deterministic insights for recurring demand/automation opportunities.

### Origem
Keep the historical inference rule for historical data. Split the view internally into `Resumo`, `Abertos pela TI`, `% de aberturas`, and `Abertos pelos usuários`. Each side gets top requesters/themes, latest tickets, and weekly participation history. New explicit origin persistence is outside this parity change.

### Satisfação
Expose internal subviews `NPS Geral` and `NPS Mensal`. No fabricated NPS is allowed. The UI must clearly report when no real satisfaction source is connected. The data contract is prepared so a real source can be added without changing the page structure.

### Base
Show the complete filtered ticket universe, not just the latest 50. Add CSV export and a ticket-detail drawer. The drawer shows all currently available structured fields: description, requester, responsible, status, priority, type, category, tags, root cause, supplier ticket/link, time tracking, dates, source and origin inference.

### Qualidade
Keep completeness indicators and expand the quality summary for root cause, priority justification, responsible, category/tags and time tracking.

## Data architecture
`src/lib/executive/query.ts` remains the server-side aggregation boundary. It loads all active tickets for the selected period with pagination and returns presentation-ready aggregates. Pure calculations move to `src/lib/executive/analytics.ts` so they are deterministic and covered by Node tests.

No Monday API calls are made from the executive page. Monday synchronization continues to populate Supabase; the executive page reads Supabase only. This keeps the dashboard fast and prevents UI availability from depending on Monday.

## UI architecture
`src/app/admin/executive/page.tsx` remains the authenticated server page protected by `requireSupport()`. Small client-only interactions are isolated in focused components: CSV export and ticket detail drawer. Navigation preserves the eight top-level sections and adds compact sub-tabs only inside Origem and Satisfação.

## Dependency classification
A ticket is considered waiting/dependent when its normalized status contains a waiting/blocking signal such as `bloqueado`, `aguardando`, `pendente`, or equivalent configured status text. This is a presentation classification only and does not mutate ticket status.

## Attention score
The attention queue is deterministic, not AI-generated. Priority weight, active dependency status and ticket age are combined to rank the tickets that need management attention. Critical/high priority always outranks normal backlog when otherwise comparable.

## Executive briefing
The briefing is generated from the current aggregates with deterministic rules: backlog trend/size, aged backlog, critical/high share, recurring themes, resolution speed and user-vs-TI opening participation. It must never invent causes not present in the data.

## NPS
NPS remains blocked until a real satisfaction dataset is integrated. The panel can display a source-status card and empty-state views, but must not derive NPS from ticket operational data.

## Security
All executive routes and server-side data access remain TI/admin-only through `requireSupport()` and existing RLS policies. No requester receives executive analytics through UI or server endpoint.

## Testing
Extend the pure executive analytics tests to cover dependency classification, attention ranking, grouped performance, weekly origin variation and executive briefing inputs. Existing auth, Monday, RLS and build checks remain unchanged.

## Acceptance criteria
1. Every legacy static portal analytical module has an equivalent location in the new executive panel.
2. All ticket-based indicators are calculated from live Supabase data for the selected period.
3. Origin detail views reproduce TI/user/weekly-share analyses.
4. Performance by type and responsible is present.
5. Backlog dependency/aging analysis is present.
6. Base supports CSV export and ticket detail inspection.
7. NPS is visible as a module but never fabricated without its real source.
8. `npm run quality` passes.
9. Access remains restricted to TI/admin.
