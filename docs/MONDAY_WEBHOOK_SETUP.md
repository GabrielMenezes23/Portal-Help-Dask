# Configuração dos webhooks do Monday

## Endpoint

```text
https://SEU-DOMINIO/api/webhooks/monday?secret=MONDAY_WEBHOOK_SECRET
```

A URL precisa ser HTTPS e ter menos de 255 caracteres.

## Eventos recomendados

- `create_item`;
- `change_column_value`;
- `change_name`;
- `item_moved_to_any_group`;
- `item_archived`;
- `item_deleted`;
- `item_restored`.

## Configuração automática

Preencha `NEXT_PUBLIC_APP_URL`, `MONDAY_WEBHOOK_SECRET`, `MONDAY_API_TOKEN` e `MONDAY_BOARD_ID` no `.env.local`.

```powershell
.\scripts\configure-monday-webhooks.ps1
```

O Monday enviará um JSON com `challenge`. A rota devolve exatamente o mesmo valor para validar a assinatura.

## Validação

1. Crie ou altere um item de teste.
2. Abra `/admin/integrations/monday`.
3. Confirme execução com origem `Webhook`.
4. Consulte:

```sql
select event_type, status, received_at, processed_at, error_message
from public.monday_webhook_events
order by received_at desc
limit 20;
```

## Observação

A reconciliação diária continua ativa mesmo com webhooks. Ela corrige eventos eventualmente perdidos e é o mecanismo de segurança da integração.
