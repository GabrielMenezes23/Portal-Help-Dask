# Relatório de validação — CAF TI Helpdesk final

**Data:** 4 de agosto de 2026  
**Escopo:** pacote consolidado de produção, sem dependência operacional de Google Apps Script, Google Sheets ou Google Drive.

## Resultado executivo

O código final foi consolidado com:

- Supabase como fonte de verdade para chamados, comentários e anexos;
- Next.js/Vercel como aplicação e backend;
- Monday como integração bidirecional resiliente;
- autenticação, autorização server-side, RLS, Storage privado, auditoria e rate limit;
- criação nativa de chamados, comentários, anexos, administração, SLA, webhooks, reconciliação e reprocessamento;
- scripts PowerShell e documentação para instalação, publicação, homologação, corte e rollback.

## Validações executadas neste ambiente

### Testes automatizados

Comando:

```text
npm test
```

Resultado:

```text
42 testes
42 aprovados
0 falhas
0 ignorados
```

Os testes cobrem, entre outros pontos:

- papéis e bloqueio de auto-remoção do administrador;
- variáveis públicas e secrets server-only;
- classificação de status e prioridades;
- transformação de chamados do Monday;
- segurança da sincronização completa;
- abertura e comentários;
- anexos e extensões bloqueadas;
- SLA com almoço, fim de semana e feriados;
- idempotência de comentários e arquivos;
- retomada de webhooks que falharam;
- deduplicação de webhooks com e sem UUID do Monday;
- rate limits por operação.

### TypeScript

- `tsc` global 5.8.3 executado em modo estrito com stubs externos controlados: **sem erros estruturais**;
- 70 arquivos TypeScript/TSX em `src` e `next.config.ts`: **71 arquivos transpilados sem erros de sintaxe**;
- os testes não foram incluídos no typecheck estrutural, pois são executados diretamente pelo Node.js.

### Banco e segurança

Foram analisadas as três migrations SQL:

1. `20260804142700_phase0_foundation.sql`;
2. `20260804154000_phase1_monday_mirror.sql`;
3. `20260804170000_final_helpdesk.sql`.

Resultados:

- transações `BEGIN/COMMIT` balanceadas;
- delimitadores, strings, comentários e corpos dollar-quoted balanceados;
- 13 tabelas públicas identificadas;
- `ENABLE ROW LEVEL SECURITY` e `FORCE ROW LEVEL SECURITY` verificados para todas as tabelas criadas;
- grants e revogações explícitos;
- bucket privado `ticket-attachments` com limite de 8 MB;
- função central de rate limit restrita a `service_role`;
- nenhuma repetição inválida de `INSERT INTO` encontrada.

### Integrações e scripts

- 9 operações GraphQL com delimitadores equilibrados;
- 11 scripts PowerShell passaram por análise lexical e estrutural textual;
- JSON e TOML parseados com sucesso;
- nenhuma chamada a `SpreadsheetApp`, `DriveApp`, `google.script.run`, Google Sheets API ou Web App do Apps Script no runtime;
- nenhuma credencial real encontrada na varredura de padrões;
- nenhum `.env`, `.env.local`, `.git`, `.next`, `node_modules`, `.vercel`, log, ZIP interno ou `tsbuildinfo` presente no projeto de entrega.

## Reforços de produção incluídos

- persistência no Supabase antes da tentativa de integração externa;
- falha do Monday não perde chamado, comentário ou anexo;
- filas e estados de reprocessamento independentes;
- marcadores idempotentes para comentários e anexos;
- eventos de webhook repetidos são deduplicados;
- eventos de webhook com falha podem ser retomados;
- sincronização completa só inativa registros ausentes depois da leitura e persistência completas;
- solicitantes veem somente seus próprios chamados;
- administradores não conseguem remover o próprio acesso;
- policies e feriados configurados no banco participam do cálculo real do SLA;
- chamados já abertos preservam o prazo calculado no momento da abertura.

## Validações que dependem do ambiente real

Não foi possível executar neste ambiente:

- `npm install` ou `npm ci`;
- ESLint com os pacotes reais;
- typecheck usando os tipos reais instalados do Next.js, React e Supabase;
- `next build`;
- análise do PowerShell pelo parser do `pwsh`;
- aplicação das migrations em um PostgreSQL/Supabase real;
- chamadas autenticadas ao Monday;
- deploy e health check reais na Vercel;
- verificação visual em navegador.

Motivo: o registro npm interno não disponibilizou os pacotes e o acesso direto ao registro público falhou com erro DNS `EAI_AGAIN`. O ambiente também não possui credenciais do Supabase, Monday ou Vercel, nem executável `pwsh`.

Essas etapas são obrigatoriamente executadas no ambiente do usuário por:

```powershell
.\scripts\setup.ps1
.\scripts\apply-migrations.ps1 -ProjectRef SEU_PROJECT_REF
.\scripts\test-monday-api.ps1
.\scripts\check.ps1
.\scripts\deploy-production.ps1
.\scripts\configure-monday-webhooks.ps1
.\scripts\cutover-check.ps1
```

## Critério de corte

O desligamento físico do Apps Script, seus gatilhos e a planilha legada não é executável sem acesso às contas da empresa. O pacote contém o fluxo completo em `docs/CUTOVER.md`. O legado deve ser congelado e desativado somente depois da homologação real descrita em `docs/FINAL_HOMOLOGATION.md`.
