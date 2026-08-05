# Sincronização Bidirecional Monday ↔ Portal — Design

## Objetivo

Transformar o Portal CAF TI e o board Monday `18389222247` em uma operação única, com criação, comentários e anexos sincronizados nos dois sentidos, preservando o Supabase como fonte segura do portal e o isolamento por usuário Microsoft.

## Regras aprovadas

### Responsável pela abertura

- Fonte: coluna dropdown do Monday `dropdown_mky7rgr1`.
- As opções ficam armazenadas no Supabase.
- Sincronização diária às 05:00 no fuso `America/Sao_Paulo`.
- Na primeira implantação ocorre sincronização imediata.
- Se a sincronização falhar, a última lista válida continua ativa.
- O campo é obrigatório.
- O nome da conta Microsoft é pré-selecionado somente quando houver correspondência exata após normalização de acentos, maiúsculas e espaços.
- O usuário pode trocar o nome selecionado.
- Quando não houver correspondência, o campo permanece vazio.
- Não é permitido criar opção nova pelo portal.
- O valor selecionado é salvo no Supabase e enviado ao Monday.

### Segurança e propriedade

- `requester_user_id` e `requester_email` continuam derivados exclusivamente da sessão Microsoft autenticada.
- `opening_responsible_name` é um dado operacional e não concede acesso ao chamado.
- O solicitante continua vendo somente os próprios tickets, mesmo ao selecionar outro responsável.
- O servidor rejeita responsáveis que não estejam ativos na lista sincronizada.

## Arquitetura

```text
Microsoft Auth
    ↓
Portal Next.js/Vercel
    ↓
Supabase Auth + PostgreSQL + Storage
    ↕
Monday API + Webhooks
```

O Supabase registra primeiro as operações iniciadas no portal. Falhas de comunicação com o Monday entram na fila existente de reprocessamento.

## Fluxos

### Portal → Monday: abertura

1. Usuário envia o formulário.
2. Servidor valida responsável contra a lista ativa do Supabase.
3. Ticket é criado no Supabase e recebe protocolo CAF.
4. Item é criado no Monday.
5. `dropdown_mky7rgr1` recebe o responsável selecionado.
6. Falhas ficam marcadas como `pending` ou `failed` para reprocessamento.

### Monday/Forms → Portal: abertura

1. Forms cria item no board.
2. Webhook `create_item` chega ao portal.
3. Portal busca o snapshot completo do item.
4. Ticket é criado ou atualizado no Supabase.
5. O usuário verá o ticket somente quando o e-mail do item corresponder ao e-mail Microsoft autenticado.
6. O cron completo permanece como reconciliação de segurança.

### Portal → Monday: comentários e anexos

1. Comentário e arquivo são salvos primeiro no Supabase/Storage.
2. Comentário é publicado como Update do item no Monday com marcador de deduplicação.
3. Arquivo é enviado ao Update correspondente, quando houver comentário, ou à coluna de arquivos configurada como fallback.
4. Falhas entram na rotina de reprocessamento.

### Monday → Portal: comentários e anexos

1. Webhooks `create_update`, `edit_update` e `delete_update` identificam alterações.
2. Portal consulta os Updates do item e seus assets.
3. Updates são gravados em `ticket_comments` usando `monday_update_id` para deduplicação.
4. Assets dos Updates e das colunas de arquivos são gravados em `ticket_attachments` usando `monday_asset_id` para deduplicação.
5. Edição atualiza o comentário existente.
6. Exclusão desativa o comentário ou anexo sem apagar histórico de auditoria.

## Modelo de dados

### `monday_dropdown_options`

- `id uuid`
- `board_id text`
- `column_id text`
- `option_id text`
- `option_label text`
- `normalized_label text`
- `is_active boolean`
- `last_seen_at timestamptz`
- `synced_at timestamptz`
- `raw_payload jsonb`
- unicidade por `board_id,column_id,option_id`

### Novas colunas em `tickets`

- `opening_responsible_option_id text`
- `opening_responsible_name text`

### Novas colunas em `ticket_comments`

- `monday_update_id text`
- `monday_parent_update_id text`
- `source_active boolean`
- `source_created_at timestamptz`
- `source_updated_at timestamptz`

Unicidade parcial por `ticket_id,monday_update_id` quando o ID não for nulo.

## Sincronização das opções

A API consulta o schema da coluna do board e extrai os labels do dropdown. A persistência ocorre em duas fases:

1. upsert de todas as opções recebidas como ativas;
2. desativação das opções não vistas somente após resposta completa e válida do Monday.

Uma falha antes da conclusão não altera a lista ativa existente.

## Webhooks necessários

- `create_item`
- `change_column_value`
- `change_name`
- `item_moved_to_any_group`
- `item_archived`
- `item_deleted`
- `create_update`
- `edit_update`
- `delete_update`

A URL usa o endpoint existente `/api/webhooks/monday` e o segredo configurado no ambiente.

## Agendamentos

- `08:00 UTC` diariamente: opções do dropdown, equivalente a 05:00 em São Paulo durante o horário padrão atual.
- rotina completa do Monday permanece como reconciliação diária;
- rotina horária de pendências permanece ativa.

## Tratamento de falhas

- Portal nunca perde dados por indisponibilidade do Monday.
- Lista de responsáveis usa a última versão válida.
- Webhooks possuem deduplicação e tentativas registradas.
- Cron completo corrige eventos perdidos.
- URLs temporárias de assets do Monday não são tratadas como armazenamento permanente; o portal atualiza metadados e URLs durante sincronizações.

## Critérios de aceitação

1. Campo responsável lista apenas opções ativas do Supabase.
2. Correspondência exata pré-seleciona o usuário; ausência deixa vazio.
3. Valor não pertencente à lista ativa é rejeitado no servidor.
4. Abertura no portal cria item no Monday com o dropdown correto.
5. Abertura pelo Forms aparece no portal após webhook e, no máximo, após reconciliação.
6. Comentário do portal aparece em Updates no Monday sem duplicação.
7. Update do Monday aparece como comentário individual no portal sem duplicação.
8. Anexos dos dois lados aparecem no outro sistema.
9. Falhas são reprocessadas sem criar duplicatas.
10. RLS e propriedade por usuário autenticado permanecem intactas.
11. Testes, lint, typecheck e build passam antes do merge.
