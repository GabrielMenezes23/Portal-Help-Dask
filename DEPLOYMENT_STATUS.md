# Status da implantação

Atualizado em 4 de agosto de 2026.

## Supabase

Projeto vinculado: `jauevfvafakrrrzfexyc` (`sa-east-1`).

Migrations aplicadas com sucesso:

1. `phase0_foundation`
2. `phase1_monday_mirror`
3. `final_helpdesk`
4. `advisor_hardening`

Estrutura criada:

- autenticação e perfis;
- papéis `requester`, `ti_agent` e `admin`;
- chamados, comentários, anexos e histórico;
- SLA, horários úteis e feriados;
- auditoria e rate limit;
- execuções e erros de integração;
- eventos de webhook do Monday;
- bucket privado `ticket-attachments`;
- RLS em todas as tabelas públicas.

O Security Advisor foi executado após o endurecimento e retornou **zero avisos**.

## GitHub

O repositório foi inicializado e validado. O código-fonte integral deve ser publicado a partir do pacote final `CAF_Helpdesk_Final_Producao.zip` após a verificação local do `package-lock.json`, lint, typecheck e build.

Nenhum segredo deve ser versionado. Use `.env.example` como referência e configure as variáveis reais na Vercel.

## Pendências externas

- publicar a árvore completa do pacote no repositório;
- configurar variáveis na Vercel;
- executar `npm install`, `npm run lint`, `npm run typecheck`, testes e `npm run build`;
- configurar o token e os webhooks do Monday;
- criar o primeiro usuário administrador;
- realizar a homologação antes do corte do Apps Script.
