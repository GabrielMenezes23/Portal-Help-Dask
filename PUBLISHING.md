# Publicação do CAF TI Helpdesk

## 1. Preparar o projeto

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\scripts\setup.ps1
```

Preencha `.env.local`. Use secrets longos e diferentes para `MONDAY_WEBHOOK_SECRET` e `CRON_SECRET`.

## 2. Supabase

```powershell
.\scripts\apply-migrations.ps1 -ProjectRef SEU_PROJECT_REF
```

As migrations são aplicadas em ordem:

1. `20260804142700_phase0_foundation.sql`;
2. `20260804154000_phase1_monday_mirror.sql`;
3. `20260804170000_final_helpdesk.sql`.

Crie o primeiro usuário em **Authentication → Users** e promova-o:

```sql
update public.profiles
set role = 'admin', active = true
where email = lower('SEU_EMAIL');
```

## 3. Monday

O token deve possuir permissões para:

- ler board, grupos, itens, colunas e assets;
- criar e alterar itens;
- enviar arquivos;
- ler e criar webhooks.

Teste sem gravar:

```powershell
.\scripts\test-monday-api.ps1
```

## 4. GitHub

```powershell
git init
git add .
git commit -m "feat: publish CAF TI Helpdesk"
git branch -M main
git remote add origin URL_DO_REPOSITORIO
git push -u origin main
```

Versione o `package-lock.json` criado pelo `npm install`.

## 5. Vercel

Use um projeto Vercel Pro ou superior, pois o pacote executa um cron horário de reprocessamento.

Cadastre todas as variáveis do `.env.example` em Preview e Production. Para produção:

```dotenv
NEXT_PUBLIC_APP_ENV=production
NEXT_PUBLIC_APP_URL=https://SEU-DOMINIO.vercel.app
```

Publique:

```powershell
.\scripts\deploy-production.ps1
```

## 6. Webhooks

Após o domínio de produção estar ativo:

```powershell
.\scripts\configure-monday-webhooks.ps1
```

O endpoint será:

```text
https://SEU-DOMINIO/api/webhooks/monday?secret=SEU_SEGREDO
```

Consulte `docs/MONDAY_WEBHOOK_SETUP.md`.

## 7. Crons

`vercel.json` configura:

- pendências: minuto 15 de cada hora;
- reconciliação completa: 21:00 UTC, equivalente a 18:00 em São Paulo.

A Vercel envia `CRON_SECRET` no header `Authorization` quando essa variável está configurada no projeto.

## 8. Validação

```powershell
.\scripts\cutover-check.ps1
```

Depois siga `docs/FINAL_HOMOLOGATION.md` e `docs/CUTOVER.md`.
