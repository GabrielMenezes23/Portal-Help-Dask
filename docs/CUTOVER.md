# Corte definitivo do Google Apps Script e Sheets

## Antes do corte

- homologação final aprovada;
- backup/exportação da planilha legada;
- lista de gatilhos registrada;
- URL do portal novo distribuída;
- plano de rollback testado;
- responsável pelo aceite definido.

## Corte

1. Coloque a planilha legada em modo somente leitura.
2. Execute uma última sincronização completa no portal novo.
3. Compare quantidade e amostras.
4. Remova o link do Web App antigo dos atalhos internos.
5. Desative os gatilhos do Apps Script.
6. Não exclua imediatamente o projeto Apps Script, a planilha ou a pasta Drive.
7. Defina o portal da Vercel como sistema oficial.
8. Monitore pendências, webhooks, auditoria e health check.

## Período de observação

Mantenha o legado congelado por prazo definido pela empresa, recomendado entre 30 e 90 dias. Ele não deve receber novos registros.

## Rollback

1. Não apague dados do Supabase.
2. Reative temporariamente o link antigo e os gatilhos somente se o incidente impedir a operação.
3. Registre o motivo e o horário.
4. Corrija o portal novo.
5. Execute reconciliação completa antes de repetir o corte.

## Encerramento

Após o período de observação e aceite:

- exporte os dados históricos necessários;
- revogue tokens e propriedades do Apps Script;
- exclua gatilhos definitivamente;
- arquive ou exclua o Web App;
- aplique a política de retenção à planilha e ao Drive legado.
