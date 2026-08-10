# CAF TI Helpdesk — Pacote final

Sistema profissional de Helpdesk da CAF Máquinas, construído com Next.js, TypeScript, Supabase, GitHub, Vercel e PowerShell.

## Arquitetura oficial

```text
Usuário / Equipe de TI
        ↓
Next.js na Vercel
        ↓
Supabase Auth + PostgreSQL + Storage
        ↕
Monday API e Webhooks
```

O sistema **não usa Google Apps Script, Google Sheets ou Google Drive** em nenhuma operação do portal.

O Supabase registra primeiro os chamados, comentários e anexos. Se o Monday estiver indisponível, os dados permanecem salvos e entram na fila de reprocessamento.

## Funcionalidades

### Solicitante

- login seguro;
- abertura nativa de chamado;
- justificativa obrigatória para prioridade Crítica e Alta;
- consulta apenas dos próprios chamados;
- filtros e paginação;
- detalhe, SLA e histórico;
- comentários e anexos de até 8 MB;
- protocolo próprio `CAF-AAAAMMDD-XXXXXXXX`.

### Equipe de TI

- visão de todos os chamados;
- dashboard operacional;
- atualização de status, causa raiz e retorno ao usuário;
- indicadores de SLA;
- sincronização das alterações com o Monday.

### Administração

- papéis `requester`, `ti_agent` e `admin`;
- ativação e inativação de usuários;
- políticas de SLA e calendário de feriados;
- auditoria;
- painel da integração;
- sincronização completa;
- reprocessamento de pendências;
- webhooks incrementais;
- cron de reconciliação.

## Monday Schema Explorer

O Helpdesk possui um inventário read-only da estrutura do Monday em `/admin/integrations/monday/schema`.

O Explorer consulta a Monday GraphQL API somente no servidor e cataloga no Supabase:

- workspaces acessíveis;
- boards e seus IDs;
- grupos;
- colunas, IDs, tipos e `settings`;
- relações entre boards;
- classificação semântica de campos relevantes ao Helpdesk e ao futuro Painel Executivo.

A visualização é restrita à equipe de TI. Somente `admin` pode disparar uma atualização manual. O cron `/api/cron/monday-schema` executa diariamente às 09:00 UTC (06:00 em `America/Sao_Paulo`). Se a descoberta falhar, o último inventário válido permanece ativo.

O arquivo Excel de tickets é usado apenas como referência de homologação. O mapa executivo compara os 36 campos da exportação com os IDs descobertos pela API e com o modelo atual do Supabase; mapeamentos `probable` ou `ambiguous` nunca entram automaticamente no pipeline operacional.

## Segurança

- Row Level Security em todas as tabelas públicas;
- solicitante vê somente os próprios chamados;
- autorização reforçada no servidor;
- Storage privado com URLs assinadas;
- secrets exclusivos do servidor;
- rate limit centralizado no PostgreSQL;
- extensões executáveis bloqueadas;
- logs sem tokens ou senhas;
- falha da integração não apaga dados nem impede a abertura de chamado.

## Requisitos

- Windows 10 ou 11;
- PowerShell 5.1 ou 7+;
- Node.js 22.13 ou superior;
- npm 10 ou superior;
- projeto Supabase;
- Supabase CLI;
- conta Monday com permissões de leitura, escrita e webhooks;
- GitHub;
- Vercel Pro ou superior (necessário para o cron horário de reprocessamento).

## Instalação local

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\scripts\setup.ps1
```

Preencha `.env.local` e aplique as três migrations:

```powershell
.\scripts\apply-migrations.ps1 -ProjectRef SEU_PROJECT_REF
```

Valide as integrações e o projeto:

```powershell
.\scripts\test-monday-api.ps1
.\scripts\check.ps1
```

Inicie:

```powershell
.\scripts\dev.ps1
```

Acesse `http://localhost:3000`.

## Variáveis de ambiente

Copie `.env.example` para `.env.local`. Nunca use `NEXT_PUBLIC_` em secrets.

```dotenv
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=

MONDAY_API_TOKEN=
MONDAY_API_VERSION=2026-07
MONDAY_BOARD_ID=18389222247
MONDAY_DEFAULT_GROUP_ID=topics
MONDAY_USER_REPLY_COLUMN_ID=long_text_mm12wpxe
MONDAY_USER_FILE_COLUMN_ID=file4t50hmgx
MONDAY_WEBHOOK_SECRET=

CRON_SECRET=
NEXT_PUBLIC_APP_NAME=CAF TI Helpdesk
NEXT_PUBLIC_APP_ENV=production
NEXT_PUBLIC_APP_URL=https://SEU-DOMINIO.vercel.app
```

## Publicação

Consulte `PUBLISHING.md`. O roteiro completo de homologação e corte está em:

- `docs/FINAL_HOMOLOGATION.md`;
- `docs/MONDAY_WEBHOOK_SETUP.md`;
- `docs/CUTOVER.md`;
- `SECURITY.md`.

## Scripts PowerShell

```powershell
.\scripts\setup.ps1
.\scripts\apply-migrations.ps1 -ProjectRef SEU_PROJECT_REF
.\scripts\test-monday-api.ps1
.\scripts\configure-monday-webhooks.ps1
.\scripts\check.ps1
.\scripts\dev.ps1
.\scripts\build.ps1
.\scripts\deploy-preview.ps1
.\scripts\deploy-production.ps1
.\scripts\cutover-check.ps1
.\scripts\package-clean.ps1
```
