import assert from 'node:assert/strict';
import test from 'node:test';

import {
  EXECUTIVE_EXCEL_FIELDS,
  KNOWN_HELPDESK_MONDAY_FIELDS,
  buildExecutiveFieldMap,
} from './executive-field-map.ts';
import type { MondaySchemaColumnRecord } from './schema-domain.ts';

const col = (
  id: string,
  title: string,
  type: string,
  semanticHint = 'unknown',
): MondaySchemaColumnRecord => ({
  boardId: '18389222247',
  id,
  title,
  type,
  description: null,
  settings: {},
  revision: null,
  archived: false,
  semanticHint: semanticHint as never,
});

test('representa exatamente os 36 campos da planilha enviada', () => {
  assert.equal(EXECUTIVE_EXCEL_FIELDS.length, 36);
  assert.equal(EXECUTIVE_EXCEL_FIELDS[0], 'Nome');
  assert.equal(EXECUTIVE_EXCEL_FIELDS[35], 'Item ID (auto generated)');
});

test('preserva IDs já confirmados no Helpdesk', () => {
  assert.equal(KNOWN_HELPDESK_MONDAY_FIELDS.requesterName, 'dropdown_mky7rgr1');
  assert.equal(KNOWN_HELPDESK_MONDAY_FIELDS.status, 'status95');
  assert.equal(KNOWN_HELPDESK_MONDAY_FIELDS.rootCause, 'long_text_mkx84r4n');
});

test('marca ID conhecido encontrado como confirmado', () => {
  const map = buildExecutiveFieldMap([
    col('email', 'E-mail', 'email', 'email'),
  ]);
  const email = map.find((entry) => entry.excelField === 'E-mail');
  assert.equal(email?.status, 'confirmed');
  assert.equal(email?.columnId, 'email');
});

test('marca Category única e semanticamente compatível como provável', () => {
  const map = buildExecutiveFieldMap([
    col('category_x', 'Category', 'status', 'category'),
  ]);
  const category = map.find((entry) => entry.excelField === 'Category');
  assert.equal(category?.status, 'probable');
  assert.equal(category?.columnId, 'category_x');
});

test('não escolhe automaticamente a segunda atualização quando há candidatos ambíguos', () => {
  const map = buildExecutiveFieldMap([
    col('update_a', 'Atualização do chamado', 'text'),
    col('update_b', 'Atualização do chamado', 'long_text'),
  ]);
  const ambiguous = map.find(
    (entry) =>
      entry.excelField === 'Atualização do chamado' &&
      entry.internalField === null &&
      entry.status === 'ambiguous',
  );
  assert.ok(ambiguous);
  assert.equal(ambiguous.columnId, null);
  assert.deepEqual(ambiguous.candidates.map((candidate) => candidate.id), ['update_a', 'update_b']);
});

test('Nome e Item ID são confirmados como metadados sem column ID', () => {
  const map = buildExecutiveFieldMap([]);
  const name = map[0];
  const itemId = map[35];
  assert.equal(name.status, 'confirmed');
  assert.equal(name.columnId, null);
  assert.equal(itemId.status, 'confirmed');
  assert.equal(itemId.columnId, null);
});
