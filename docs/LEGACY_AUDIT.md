# Auditoria do sistema legado — base para migração

## Fontes analisadas

- Script de sincronização Monday → Google Sheets/Drive.
- HTML/CSS/JavaScript do portal CAF TI Helpdesk Hub.
- Backend Apps Script de consulta, SLA, dashboard, paginação e resposta ao Monday.

## Fluxo produtivo atual

```text
Monday board
  └─ Apps Script diário/manual
       ├─ Google Sheets: Monday TI Chamados
       └─ Google Drive: cópia de anexos

Portal Apps Script
  ├─ consulta a planilha
  ├─ calcula SLA
  ├─ mostra busca/dashboard/gerenciamento
  └─ escreve comentário e anexo de volta no Monday
```

O Monday é a origem operacional. A planilha é um espelho reescrito integralmente.

## Trigger

- Handler: `atualizarMondayChamadosTI`.
- Periodicidade: diária.
- Horário configurado: 18h.
- Existe atualização manual pelo portal.
- Lock global evita duas sincronizações simultâneas.

## Grupos do Monday

- não atribuídos;
- abertos;
- resolvidos;
- bloqueados;
- cancelados.

## Colunas sincronizadas

| Campo interno | Coluna Monday |
|---|---|
| E-mail | `email` |
| Criação | `date` |
| Resolução | `date6` |
| Descrição | `long_text7` |
| Responsável | `people0` |
| Status | `status95` |
| Prioridade | `priority` |
| Justificativa | `long_textzr7lt7g8` |
| Tipo | `request_type` |
| Causa raiz | `long_text_mkx84r4n` |
| Atualização | `text_mm0qa8s9` |
| Solicitante | `dropdown_mky7rgr1` |
| Resposta do usuário | `long_text_mm12wpxe` |
| Arquivos antigos | `file_mm12mh4c` |
| Arquivos do usuário | `file4t50hmgx` |

## Estrutura atual da planilha

A aba `Monday TI Chamados` possui:

1. Item ID;
2. Item Name;
3. Grupo;
4. Data de criação;
5. Data da resolução;
6. Status;
7. Prioridade;
8. Nome do operador;
9. E-mail;
10. Responsável TI;
11. Tipo de solicitação;
12. Justificativa;
13. Causa raiz;
14. Atualização;
15. Descrição;
16. Resposta do usuário;
17. Arquivos.

## Regras de SLA

| Prioridade | Prazo útil |
|---|---:|
| Crítica | 4 horas |
| Alta | 16 horas |
| Média | 32 horas |
| Baixa | 100 horas |

Jornada configurada:

- segunda a sexta-feira;
- 07:42–13:00;
- 14:00–17:00;
- alerta quando restam até 2 horas úteis;
- sem calendário de feriados.

## Funções que deverão virar serviços

| Apps Script | Destino previsto |
|---|---|
| `atualizarMondayChamadosTI` | serviço de sincronização |
| `buscarItensDoGrupo_` | cliente Monday paginado |
| `buscarAssetsMap_` | cliente de assets |
| `baixarAssetParaDrive_` | ingestão/Storage |
| `searchTicketsFiltered` | consulta segura no PostgreSQL |
| `getDashboardData` | agregações SQL/API admin |
| `listTicketsPaged` | paginação no banco |
| `computeSla_` | serviço de domínio de SLA |
| `submitUserReply` | comando autenticado e auditado |
| `mondayAppendUserReply_` | adaptador de escrita Monday |
| `mondayAddIncidentFile_` | adaptador de upload Monday |

## Riscos obrigatórios para a Fase 1 e seguintes

1. Usuário comum pode pesquisar registros de outros solicitantes.
2. Dashboard e gerenciamento são bloqueados visualmente, mas o backend legado não reforça o papel em todas as funções.
3. `submitUserReply` recebe um `itemId` sem comprovar ownership.
4. O e-mail do autor pode ser informado manualmente.
5. A sincronização manual pode consumir quotas e reprocessar toda a base.
6. A planilha é limpa antes da regravação completa.
7. Consultas percorrem a planilha inteira.
8. Paginação ocorre depois de carregar todos os registros.
9. Cancelados podem cair no bucket padrão de abertos.
10. O indicador “Sistema Online” é fixo, não um health check real.
11. Arquivos têm limite de tamanho, mas não há política completa de tipo, frequência e auditoria.
12. Comentários são concatenados em um long text, dificultando histórico estruturado.

## Decisão de migração

Na convivência inicial:

- Monday permanece a fonte oficial;
- Supabase será uma réplica estruturada;
- o portal novo consultará Supabase;
- escritas continuarão no Monday por adaptadores server-side;
- Apps Script será preservado até homologação e rollback aprovado.
