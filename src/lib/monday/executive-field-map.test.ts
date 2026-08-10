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

const CONFIRMED_COLUMNS = [
  col('long_text7', 'Descrição', 'long_text'),
  col('link_mm129mxs', 'Link dos chamados', 'link'),
  col('text_mm13vc8a', 'N° do chamado Fornecedor', 'text', 'supplier_ticket'),
  col('text_mm0qa8s9', 'Atualização do chamado', 'text'),
  col('file_mm12mh4c', 'Arquivos para atualizar chamado', 'file', 'file'),
  col('dropdown_mky7rgr1', 'Nome do Funcionário', 'dropdown', 'requester'),
  col('people0', 'Responsavel', 'people'),
  col('status95', 'Status', 'status', 'status'),
  col('priority', 'Prioridade', 'status', 'priority'),
  col('request_type', 'Tipo de solicitação', 'status', 'request_type'),
  col('long_text_mm12wpxe', 'Resposta do Usuário ao chamado', 'long_text'),
  col('date', 'Data de criação', 'date'),
  col('file4t50hmgx', 'Arquivo para incidentes', 'file', 'file'),
  col('long_textzr7lt7g8', 'Justificativa da Prioridade', 'long_text'),
  col('email', 'E-mail', 'email', 'email'),
  col('color_mky7e9gb', 'Category', 'status', 'category'),
  col('connect_boards2', 'Incidentes', 'board_relation', 'incident'),
  col('text_mm03gt7h', 'Atualização do chamado', 'text'),
  col('date6', 'Data de resolução', 'date'),
  col('duration_mkx84qkj', 'Controle de tempo Tickets criado', 'time_tracking', 'time_tracking'),
  col('duration_mky1bm3m', 'Controle de tempo tickets aberto', 'time_tracking', 'time_tracking'),
  col('long_text_mkx84r4n', 'Causa Raiz', 'long_text', 'root_cause'),
  col('tag_mkxckwr6', 'Tags', 'tags', 'tags'),
  col('text_mkxc1g3v', 'Texto', 'text'),
  col('file7nrte5gu', 'Arquivo para requisição de serviço', 'file', 'file'),
  col('filee09d9aft', 'Dup. of Preencha o documento para requisição de serviços', 'file', 'file'),
  col('text_mky2g5f9', 'Responsável', 'text'),
  col('text_mky7mt6k', 'Hardware Issue', 'text', 'hardware'),
  col('text_mky78j9s', 'Software Service Issue', 'text', 'software'),
  col('doc_mky7zkr4', 'monday Doc', 'doc'),
  col('filenlou89rv', 'Arquivo', 'file', 'file'),
  col('single_selectlqa52kw', 'Seleção individual', 'status'),
  col('text', 'Nome do funcionário', 'text', 'requester'),
];

test('representa exatamente os 36 campos da planilha enviada', () => {
  assert.equal(EXECUTIVE_EXCEL_FIELDS.length, 36);
  assert.equal(EXECUTIVE_EXCEL_FIELDS[0], 'Nome');
  assert.equal(EXECUTIVE_EXCEL_FIELDS[35], 'Item ID (auto generated)');
});

test('preserva IDs já confirmados no Helpdesk e pelo Explorer', () => {
  assert.equal(KNOWN_HELPDESK_MONDAY_FIELDS.requesterName, 'dropdown_mky7rgr1');
  assert.equal(KNOWN_HELPDESK_MONDAY_FIELDS.status, 'status95');
  assert.equal(KNOWN_HELPDESK_MONDAY_FIELDS.rootCause, 'long_text_mkx84r4n');
  assert.equal(KNOWN_HELPDESK_MONDAY_FIELDS.category, 'color_mky7e9gb');
  assert.equal(KNOWN_HELPDESK_MONDAY_FIELDS.tags, 'tag_mkxckwr6');
  assert.equal(KNOWN_HELPDESK_MONDAY_FIELDS.workTime, 'duration_mkx84qkj');
  assert.equal(KNOWN_HELPDESK_MONDAY_FIELDS.openTime, 'duration_mky1bm3m');
  assert.equal(KNOWN_HELPDESK_MONDAY_FIELDS.incidentFiles, 'file4t50hmgx');
  assert.equal(KNOWN_HELPDESK_MONDAY_FIELDS.requestFiles, 'file7nrte5gu');
});

test('marca os campos confirmados pelo inventário real com seus IDs exatos', () => {
  const map = buildExecutiveFieldMap(CONFIRMED_COLUMNS);
  const byIndex = new Map(map.map((entry) => [entry.excelIndex, entry]));

  assert.equal(byIndex.get(3)?.columnId, 'link_mm129mxs');
  assert.equal(byIndex.get(4)?.columnId, 'text_mm13vc8a');
  assert.equal(byIndex.get(5)?.columnId, 'text_mm0qa8s9');
  assert.equal(byIndex.get(14)?.columnId, 'file4t50hmgx');
  assert.equal(byIndex.get(17)?.columnId, 'color_mky7e9gb');
  assert.equal(byIndex.get(18)?.columnId, 'connect_boards2');
  assert.equal(byIndex.get(19)?.columnId, 'text_mm03gt7h');
  assert.equal(byIndex.get(21)?.columnId, 'duration_mkx84qkj');
  assert.equal(byIndex.get(22)?.columnId, 'duration_mky1bm3m');
  assert.equal(byIndex.get(24)?.columnId, 'tag_mkxckwr6');
  assert.equal(byIndex.get(26)?.columnId, 'file7nrte5gu');
  assert.equal(byIndex.get(28)?.columnId, 'text_mky2g5f9');
  assert.equal(byIndex.get(29)?.columnId, 'text_mky7mt6k');
  assert.equal(byIndex.get(30)?.columnId, 'text_mky78j9s');
  assert.equal(byIndex.get(33)?.columnId, 'single_selectlqa52kw');
  assert.equal(byIndex.get(34)?.columnId, 'text');

  for (const index of [3,4,5,14,17,18,19,21,22,24,26,28,29,30,33,34]) {
    assert.equal(byIndex.get(index)?.status, 'confirmed');
  }
});

test('marca ID conhecido encontrado como confirmado', () => {
  const map = buildExecutiveFieldMap([
    col('email', 'E-mail', 'email', 'email'),
  ]);
  const email = map.find((entry) => entry.excelField === 'E-mail');
  assert.equal(email?.status, 'confirmed');
  assert.equal(email?.columnId, 'email');
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
