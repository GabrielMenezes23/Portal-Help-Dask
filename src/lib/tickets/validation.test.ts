import assert from 'node:assert/strict';
import test from 'node:test';

import {
  normalizeManagementText,
  validateCommentInput,
  validateNewTicketInput,
  validateUpload,
  validateUploads,
} from './validation.ts';

test('prioridade crítica exige justificativa', () => {
  const result = validateNewTicketInput({
    title: 'Servidor indisponível',
    description: 'Não consigo acessar o sistema de produção.',
    priority: 'critical',
    requestType: 'Infraestrutura',
    justification: '',
  });

  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.errors.justification ?? '', /obrigatória/i);
});

test('normaliza um novo chamado válido', () => {
  const result = validateNewTicketInput({
    title: '  Erro no SAP  ',
    description: '  O apontamento não conclui.  ',
    priority: 'high',
    requestType: '  SAP  ',
    justification: '  Processo de expedição parado.  ',
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.title, 'Erro no SAP');
    assert.equal(result.value.requestType, 'SAP');
    assert.equal(result.value.justification, 'Processo de expedição parado.');
  }
});

test('comentário aceita texto ou arquivo, mas não ambos vazios', () => {
  assert.equal(validateCommentInput({ message: '', hasFile: false }).ok, false);
  assert.equal(validateCommentInput({ message: '', hasFile: true }).ok, true);
  assert.equal(validateCommentInput({ message: 'Atualização', hasFile: false }).ok, true);
});


test('upload bloqueia extensões executáveis mesmo com MIME genérico', () => {
  const file = new File(['echo teste'], 'atalho.cmd', { type: 'application/octet-stream' });
  const result = validateUpload(file);
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.errors.file ?? '', /não é permitido/i);
});

test('valida vários anexos no mesmo envio', () => {
  const result = validateUploads([
    new File(['um'], 'um.txt', { type: 'text/plain' }),
    new File(['dois'], 'dois.txt', { type: 'text/plain' }),
  ]);

  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.value.length, 2);
});


test('normaliza textos administrativos antes de banco e integração', () => {
  assert.equal(normalizeManagementText('  atualização  '), 'atualização');
  assert.equal(normalizeManagementText('x'.repeat(5000)).length, 4000);
});
