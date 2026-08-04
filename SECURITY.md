# Segurança — CAF TI Helpdesk

## Segredos

Somente servidor:

- `SUPABASE_SECRET_KEY`;
- `MONDAY_API_TOKEN`;
- `MONDAY_WEBHOOK_SECRET`;
- `CRON_SECRET`.

Nunca coloque esses valores em variáveis `NEXT_PUBLIC_*`, código, commits, prints, logs ou pacotes.

## Autenticação e autorização

- Supabase Auth gerencia sessões;
- papéis ficam em `public.profiles`, não em `user_metadata`;
- solicitante lê apenas tickets ligados ao próprio usuário ou e-mail autenticado;
- `ti_agent` e `admin` possuem acesso de suporte;
- ações administrativas são validadas no servidor;
- usuários inativos são bloqueados.

## Banco e RLS

- RLS e `FORCE ROW LEVEL SECURITY` nas tabelas expostas;
- grants explícitos;
- funções privilegiadas revogadas de `PUBLIC`, `anon` e `authenticated`;
- `service_role` usada somente em módulos server-only;
- views privilegiadas não são utilizadas;
- rate limit é consumido de forma atômica no PostgreSQL.

## Arquivos

- bucket `ticket-attachments` privado;
- acesso por URL assinada;
- limite de 8 MB;
- checksum SHA-256;
- nomes normalizados no caminho interno;
- executáveis e scripts bloqueados por MIME e extensão;
- falha ao registrar metadados remove o objeto órfão do Storage.

## Monday

- versão de API fixada em `2026-07`;
- token apenas no header do servidor;
- timeouts e tentativas limitados;
- webhook protegido por secret longo na URL ou header;
- eventos deduplicados, com retomada segura de eventos que falharam;
- comentários e anexos possuem marcadores idempotentes e estado de sincronização separado para evitar duplicidade;
- uma falha externa nunca remove o registro do Supabase.

## Crons

- exigem `Authorization: Bearer CRON_SECRET`;
- comparação com `timingSafeEqual`;
- execução sem cache;
- cron horário para pendências;
- reconciliação completa diária.

## Checklist de publicação

```powershell
.\scripts\check.ps1
.\scripts\cutover-check.ps1
```

Confirme que o pacote não contém `.env.local`, `.git`, `.next`, `node_modules`, `.vercel`, logs ou ZIPs internos.
