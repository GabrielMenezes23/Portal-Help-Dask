# Homologação final

## Pré-requisitos

- três migrations aplicadas;
- bucket privado criado;
- administrador ativo;
- variáveis Vercel configuradas;
- deployment Production saudável;
- conexão Monday validada;
- webhooks configurados;
- crons ativos.

## Testes de solicitante

1. Entrar com usuário `requester`.
2. Abrir chamado de prioridade Média.
3. Abrir chamado de prioridade Alta e confirmar exigência de justificativa.
4. Anexar imagem ou PDF menor que 8 MB.
5. Confirmar protocolo CAF.
6. Confirmar que o chamado aparece imediatamente, mesmo com Monday temporariamente indisponível.
7. Adicionar comentário com e sem anexo.
8. Tentar localizar ticket de outro usuário e confirmar bloqueio.

## Testes da TI

1. Entrar como `ti_agent`.
2. Visualizar toda a fila.
3. Filtrar por status, prioridade e categoria.
4. Alterar status para Em andamento.
5. Registrar atualização e causa raiz.
6. Resolver o chamado.
7. Confirmar histórico e SLA.

## Testes administrativos

1. Alterar papel e ativação de usuário.
2. Atualizar política de SLA.
3. Cadastrar feriado.
4. Consultar auditoria.
5. Executar sincronização completa.
6. Reprocessar pendências.
7. Confirmar eventos de webhook processados.

## Consultas SQL

```sql
select status_bucket, priority_key, count(*)
from public.tickets
where source_active = true
group by status_bucket, priority_key
order by status_bucket, priority_key;

select external_sync_status, count(*)
from public.tickets
group by external_sync_status;

select monday_sync_status, count(*)
from public.ticket_comments
group by monday_sync_status;

select monday_sync_status, count(*)
from public.ticket_attachments
group by monday_sync_status;

select status, count(*)
from public.monday_webhook_events
group by status;

select action, success, count(*)
from public.audit_events
group by action, success
order by action;
```

## Critérios de aprovação

- nenhum acesso cruzado entre solicitantes;
- criação, comentário e anexo persistem no Supabase;
- falha do Monday gera pendência, não perda de dados;
- reprocessamento elimina pendências após restabelecimento;
- Storage permanece privado;
- dashboard e SLA coerentes;
- webhooks atualizam itens por amostragem;
- cron completo conclui sem desativação indevida;
- build de produção e health check aprovados.
