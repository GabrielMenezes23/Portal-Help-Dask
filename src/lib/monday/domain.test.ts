import assert from 'node:assert/strict';
import test from 'node:test';

import {
  extractAssetIds,
  mapMondayItem,
  normalizePriority,
  normalizeStatusBucket,
  parseMondayDate,
  stripPortalReferenceFromTitle,
  type MondayItem,
} from './domain.ts';

test('remove protocolo técnico do título sincronizado', () => {
  assert.equal(
    stripPortalReferenceFromTitle('CAF-20260813-66B0CD0C · WMS - XML A INTEGRAR'),
    'WMS - XML A INTEGRAR',
  );
  assert.equal(stripPortalReferenceFromTitle('Título sem protocolo'), 'Título sem protocolo');
});

test('classifies cancelled tickets without falling back to open', () => {
  assert.equal(normalizeStatusBucket('Cancelado', 'group_mkyss0vv'), 'cancelled');
  assert.equal(normalizeStatusBucket('Resolvido', 'new_group'), 'resolved');
  assert.equal(normalizeStatusBucket('Bloqueado', 'group_mm0z7g4s'), 'in_progress');
  assert.equal(normalizeStatusBucket('Novo', 'topics'), 'open');
});

test('normalizes supported priorities and unknown values', () => {
  assert.equal(normalizePriority('Crítica'), 'critical');
  assert.equal(normalizePriority('ALTA'), 'high');
  assert.equal(normalizePriority('Média'), 'medium');
  assert.equal(normalizePriority('Baixa'), 'low');
  assert.equal(normalizePriority('Sem definição'), 'unknown');
});

test('parses ISO and Brazilian dates safely', () => {
  assert.equal(parseMondayDate('2026-08-04'), '2026-08-04T00:00:00.000Z');
  assert.equal(parseMondayDate('04/08/2026 12:15'), '2026-08-04T15:15:00.000Z');
  assert.equal(parseMondayDate(''), null);
});

test('deduplicates asset ids from all confirmed ticket file columns', () => {
  assert.deepEqual(
    extractAssetIds([
      { id: 'file_mm12mh4c', text: '', value: '{"files":[{"assetId":10},{"assetId":20}]}' },
      { id: 'file4t50hmgx', text: '', value: '{"files":[{"assetId":20},{"assetId":30}]}' },
      { id: 'file7nrte5gu', text: '', value: '{"files":[{"assetId":40}]}' },
      { id: 'filee09d9aft', text: '', value: '{"files":[{"assetId":50}]}' },
      { id: 'filenlou89rv', text: '', value: '{"files":[{"assetId":60}]}' },
    ]),
    ['10', '20', '30', '40', '50', '60'],
  );
});

test('maps legacy and executive ticket fields into a structured record', () => {
  const item: MondayItem = {
    id: '123456',
    name: 'Erro no SAP',
    created_at: '2026-08-04T12:00:00Z',
    updated_at: '2026-08-04T12:30:00Z',
    group: { id: 'group_title', title: 'Tickets abertos' },
    column_values: [
      { id: 'email', text: 'USER@CAFMAQUINAS.COM.BR', value: null },
      { id: 'date', text: '04/08/2026 09:00', value: null },
      { id: 'date6', text: '', value: null },
      { id: 'long_text7', text: 'Não consigo acessar.', value: null },
      { id: 'people0', text: 'Gabriel', value: null },
      { id: 'text_mky2g5f9', text: 'Gabriel Menezes', value: null },
      { id: 'status95', text: 'Em andamento', value: null },
      { id: 'priority', text: 'Alta', value: null },
      { id: 'long_textzr7lt7g8', text: 'Impacta faturamento', value: null },
      { id: 'request_type', text: 'SAP', value: null },
      { id: 'single_selectlqa52kw', text: 'Software', value: null },
      { id: 'long_text_mkx84r4n', text: 'Permissão', value: null },
      { id: 'text_mm0qa8s9', text: 'Em análise', value: null },
      { id: 'text_mm03gt7h', text: 'Retorno fornecedor', value: null },
      { id: 'dropdown_mky7rgr1', text: 'Maria', value: null },
      { id: 'text', text: 'Maria da Silva', value: null },
      { id: 'long_text_mm12wpxe', text: 'Preciso de retorno', value: null },
      { id: 'color_mky7e9gb', text: 'Sistema', value: null },
      { id: 'tag_mkxckwr6', text: 'SAP, Financeiro, SAP', value: null },
      { id: 'text_mm13vc8a', text: 'FORN-7788', value: null },
      { id: 'link_mm129mxs', text: 'Chamado fornecedor', value: '{"url":"https://fornecedor.test/ticket/7788","text":"Chamado fornecedor"}' },
      { id: 'duration_mkx84qkj', text: '01:30:00', value: null, duration: 5400 },
      { id: 'duration_mky1bm3m', text: '02:00:00', value: null, duration: 7200 },
      { id: 'text_mky7mt6k', text: 'Notebook', value: null },
      { id: 'text_mky78j9s', text: 'SAP Business One', value: null },
      { id: 'connect_boards2', text: 'INC-123', value: null },
      { id: 'file_mm12mh4c', text: '', value: '{"files":[{"assetId":99}]}' },
      { id: 'file4t50hmgx', text: '', value: '{"files":[{"assetId":99},{"assetId":100}]}' },
      { id: 'file7nrte5gu', text: '', value: '{"files":[{"assetId":101}]}' },
    ],
  };

  const result = mapMondayItem(item, '18389222247', 'run-1', new Date('2026-08-04T15:00:00Z'));

  assert.equal(result.ticket.monday_item_id, '123456');
  assert.equal(result.ticket.requester_email, 'user@cafmaquinas.com.br');
  assert.equal(result.ticket.requester_name, 'Maria');
  assert.equal(result.ticket.requester_name_text, 'Maria da Silva');
  assert.equal(result.ticket.responsible_name, 'Gabriel');
  assert.equal(result.ticket.responsible_text, 'Gabriel Menezes');
  assert.equal(result.ticket.status_bucket, 'in_progress');
  assert.equal(result.ticket.priority_key, 'high');
  assert.equal(result.ticket.description, 'Não consigo acessar.');
  assert.equal(result.ticket.user_reply_raw, 'Preciso de retorno');
  assert.equal(result.ticket.category, 'Sistema');
  assert.equal(result.ticket.tags_raw, 'SAP, Financeiro, SAP');
  assert.deepEqual(result.ticket.tags, ['SAP', 'Financeiro']);
  assert.equal(result.ticket.supplier_ticket, 'FORN-7788');
  assert.equal(result.ticket.supplier_link, 'https://fornecedor.test/ticket/7788');
  assert.equal(result.ticket.secondary_update, 'Retorno fornecedor');
  assert.equal(result.ticket.work_time_seconds, 5400);
  assert.equal(result.ticket.open_time_seconds, 7200);
  assert.equal(result.ticket.hardware_issue, 'Notebook');
  assert.equal(result.ticket.software_issue, 'SAP Business One');
  assert.equal(result.ticket.incident_relation, 'INC-123');
  assert.equal(result.ticket.service_subtype, 'Software');
  assert.deepEqual(result.assetIds, ['99', '100', '101']);
});
