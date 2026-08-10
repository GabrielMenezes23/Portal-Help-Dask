import assert from 'node:assert/strict';
import test from 'node:test';

import {
  classifyPriorityBoard,
  classifySemanticHint,
  normalizeSchemaText,
  parseBoardRelationTargets,
  selectDirectSchemaBoardIds,
  type MondaySchemaBoard,
  type MondaySchemaColumn,
} from './schema-domain.ts';

const column = (partial: Partial<MondaySchemaColumn>): MondaySchemaColumn => ({
  id: partial.id || 'column',
  title: partial.title || 'Coluna',
  type: partial.type || 'text',
  description: partial.description || null,
  settings: partial.settings || {},
  revision: partial.revision || null,
  archived: partial.archived || false,
});

const board = (partial: Partial<MondaySchemaBoard>): MondaySchemaBoard => ({
  id: partial.id || '1',
  name: partial.name || 'Board comum',
  boardKind: partial.boardKind || 'public',
  state: partial.state || 'active',
  url: partial.url || '',
  updatedAt: partial.updatedAt || null,
  workspaceId: partial.workspaceId || null,
});

test('normaliza acentos, pontuação e espaços', () => {
  assert.equal(normalizeSchemaText('  Satisfação / NPS  '), 'satisfacao nps');
  assert.equal(normalizeSchemaText('N° do chamado   Fornecedor'), 'n do chamado fornecedor');
});

test('extrai boardIds de settings de board relation sem duplicar', () => {
  assert.deepEqual(
    parseBoardRelationTargets(column({
      id: 'rel',
      title: 'Hardware Issue',
      type: 'board_relation',
      settings: { boardIds: [123, '456', 123] },
    })),
    ['123', '456'],
  );
});

test('aceita boardId singular em settings', () => {
  assert.deepEqual(
    parseBoardRelationTargets(column({
      type: 'board_relation',
      settings: { boardId: 789 },
    })),
    ['789'],
  );
});

test('não interpreta relações em coluna de outro tipo', () => {
  assert.deepEqual(
    parseBoardRelationTargets(column({ type: 'text', settings: { boardIds: [123] } })),
    [],
  );
});

test('mantém apenas o board Tickets e destinos ligados diretamente a ele', () => {
  assert.deepEqual(
    selectDirectSchemaBoardIds('18389222247', [
      {
        sourceBoardId: '18389222247',
        sourceColumnId: 'connect_a',
        targetBoardId: '200',
        relationType: 'board_relation',
      },
      {
        sourceBoardId: '200',
        sourceColumnId: 'connect_b',
        targetBoardId: '300',
        relationType: 'board_relation',
      },
      {
        sourceBoardId: '999',
        sourceColumnId: 'connect_c',
        targetBoardId: '400',
        relationType: 'board_relation',
      },
      {
        sourceBoardId: '18389222247',
        sourceColumnId: 'connect_d',
        targetBoardId: '200',
        relationType: 'board_relation',
      },
    ]),
    ['18389222247', '200'],
  );
});

test('classifica semântica por tipo e título', () => {
  assert.equal(classifySemanticHint(column({ id: 'tags', title: 'Tags', type: 'tags' })), 'tags');
  assert.equal(classifySemanticHint(column({ id: 'tt', title: 'Controle de tempo aberto', type: 'time_tracking' })), 'time_tracking');
  assert.equal(classifySemanticHint(column({ id: 'supplier', title: 'N° do chamado Fornecedor', type: 'text' })), 'supplier_ticket');
  assert.equal(classifySemanticHint(column({ id: 'category', title: 'Category', type: 'status' })), 'category');
  assert.equal(classifySemanticHint(column({ id: 'hardware', title: 'Hardware Issue', type: 'board_relation' })), 'hardware');
  assert.equal(classifySemanticHint(column({ id: 'software', title: 'Software Service Issue', type: 'board_relation' })), 'software');
  assert.equal(classifySemanticHint(column({ id: 'mirror', title: 'Incidentes', type: 'mirror' })), 'incident');
});

test('prioriza board principal', () => {
  assert.deepEqual(
    classifyPriorityBoard(board({ id: '18389222247', name: 'Tickets' }), '18389222247', new Set()),
    { priority: true, reason: 'board_principal' },
  );
});

test('prioriza board relacionado', () => {
  assert.deepEqual(
    classifyPriorityBoard(board({ id: '777', name: 'Cadastro auxiliar' }), '18389222247', new Set(['777'])),
    { priority: true, reason: 'board_relacionado' },
  );
});

test('prioriza boards com termos relevantes e ignora board comum', () => {
  assert.deepEqual(
    classifyPriorityBoard(board({ id: '2', name: 'Pesquisa de Satisfação TI' }), '18389222247', new Set()),
    { priority: true, reason: 'nome_relevante' },
  );
  assert.deepEqual(
    classifyPriorityBoard(board({ id: '3', name: 'Marketing 2026' }), '18389222247', new Set()),
    { priority: false, reason: '' },
  );
});
