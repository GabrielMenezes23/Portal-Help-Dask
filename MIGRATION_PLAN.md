# Estado final da migração

## Objetivo atingido no código

O pacote final elimina a dependência operacional de:

- Google Apps Script;
- Google Sheets;
- Google Drive.

A arquitetura oficial passa a ser:

```text
Next.js/Vercel + Supabase Auth/PostgreSQL/Storage + Monday API/Webhooks
```

## Fases concluídas no pacote

### Fase 0 — Fundação

- projeto Next.js e TypeScript;
- autenticação;
- perfis e papéis;
- RLS;
- layout;
- GitHub, Vercel e PowerShell.

### Fase 1 — Integração direta

- Monday → Supabase sem planilha intermediária;
- importação completa;
- reconciliação agendada;
- logs de execução e erro.

### Fase 2 — Portal funcional

- busca segura;
- filtros;
- detalhes;
- dashboard;
- administração de chamados.

### Fase 3 — Comentários e anexos

- comentários normalizados;
- Storage privado;
- upload com validação;
- escrita resiliente no Monday;
- reprocessamento e auditoria.

### Fase 4 — Incremental

- endpoint de webhook;
- challenge do Monday;
- deduplicação;
- atualização por item;
- cron de reconciliação e fila de pendências.

### Fase 5 — Abertura nativa

- formulário interno;
- protocolo CAF;
- regras de prioridade;
- persistência no Supabase antes da integração externa.

### Fase 6 — Corte

- documentos de homologação;
- roteiro de rollback;
- scripts de validação e publicação;
- pacote limpo para produção.

## Ação operacional restante

O código está consolidado. O desligamento físico do Apps Script e dos gatilhos deve ocorrer somente depois da homologação no ambiente real, seguindo `docs/CUTOVER.md`.
