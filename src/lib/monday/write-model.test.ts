import assert from 'node:assert/strict';
import test from 'node:test';

import { appendUniqueMondayText, buildCreateItemColumnValues, formatPortalCommentBlock, pendingTicketSyncMode, shouldUpdateMondayTicketFields, mondayAttachmentMarker, markedMondayFileName } from './write-model.ts';

test('monta colunas do Monday sem credenciais e com justificativa', () => {
  const values = buildCreateItemColumnValues({
    email: 'usuario@cafmaquinas.com.br',
    openedDate: '2026-08-04',
    description: 'Impressora sem conexão',
    priority: 'high',
    requestType: 'Impressora',
    justification: 'Expedição parada',
  });

  assert.deepEqual(values.email, {
    email: 'usuario@cafmaquinas.com.br',
    text: 'usuario@cafmaquinas.com.br',
  });
  assert.deepEqual(values.priority, { label: 'Alta' });
  assert.deepEqual(values.long_textzr7lt7g8, { text: 'Expedição parada' });
  assert.equal(JSON.stringify(values).includes('token'), false);
});

test('formata comentário com autor e data', () => {
  const text = formatPortalCommentBlock({
    authorEmail: 'usuario@cafmaquinas.com.br',
    message: 'Teste concluído.',
    timestamp: new Date('2026-08-04T17:00:00.000Z'),
  });

  assert.match(text, /04\/08\/2026 14:00/);
  assert.match(text, /usuario@cafmaquinas.com.br/);
  assert.match(text, /Teste concluído/);
});


test('inclui marcador técnico para tornar comentário idempotente', () => {
  const text = formatPortalCommentBlock({
    authorEmail: 'usuario@cafmaquinas.com.br',
    message: 'Retorno único.',
    commentId: '11111111-2222-3333-4444-555555555555',
    timestamp: new Date('2026-08-04T17:00:00.000Z'),
  });

  assert.match(text, /\[CAF-COMMENT:11111111-2222-3333-4444-555555555555\]/);
});

test('não anexa novamente um comentário cujo marcador já existe', () => {
  const marker = '[CAF-COMMENT:11111111-2222-3333-4444-555555555555]';
  const existing = `Mensagem anterior
${marker}`;
  const result = appendUniqueMondayText(existing, `Nova tentativa
${marker}`, marker);
  assert.equal(result.changed, false);
  assert.equal(result.text, existing);
});

test('anexa comentário novo preservando o histórico existente', () => {
  const marker = '[CAF-COMMENT:aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee]';
  const result = appendUniqueMondayText('Mensagem anterior', `Nova mensagem
${marker}`, marker);
  assert.equal(result.changed, true);
  assert.equal(result.text, `Mensagem anterior

Nova mensagem
${marker}`);
});


test('planeja criação ou atualização conforme existência do item no Monday', () => {
  assert.equal(pendingTicketSyncMode(null), 'create');
  assert.equal(pendingTicketSyncMode('123456'), 'update');
});

test('reaplica estado atual quando chamado mudou antes da sincronização', () => {
  assert.equal(shouldUpdateMondayTicketFields({ status: 'open', rootCause: '', currentUpdate: '' }), false);
  assert.equal(shouldUpdateMondayTicketFields({ status: 'in_progress', rootCause: '', currentUpdate: '' }), true);
  assert.equal(shouldUpdateMondayTicketFields({ status: 'open', rootCause: 'Falha de rede', currentUpdate: '' }), true);
});


test('marca o nome do anexo para reenvio idempotente', () => {
  const id = '11111111-2222-3333-4444-555555555555';
  assert.equal(mondayAttachmentMarker(id), `CAF-ATTACHMENT-${id}`);
  assert.equal(
    markedMondayFileName(id, 'evidência final.pdf'),
    `CAF-ATTACHMENT-${id}--evidência final.pdf`,
  );
});
