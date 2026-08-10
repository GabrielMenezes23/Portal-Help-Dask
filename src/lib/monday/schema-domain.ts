export type MondaySchemaWorkspace = {
  id: string;
  name: string;
  description: string | null;
  kind: string;
  state: string;
};

export type MondaySchemaBoard = {
  id: string;
  name: string;
  boardKind: string;
  state: string;
  url: string;
  updatedAt: string | null;
  workspaceId: string | null;
};

export type MondaySchemaGroup = {
  boardId: string;
  id: string;
  title: string;
  position: string;
  archived: boolean;
};

export type MondaySchemaColumn = {
  id: string;
  title: string;
  type: string;
  description?: string | null;
  settings?: Record<string, unknown> | null;
  revision?: string | null;
  archived: boolean;
};

export type MondaySemanticHint =
  | 'category'
  | 'tags'
  | 'supplier_ticket'
  | 'supplier_link'
  | 'time_tracking'
  | 'hardware'
  | 'software'
  | 'incident'
  | 'satisfaction'
  | 'file'
  | 'board_relation'
  | 'mirror'
  | 'requester'
  | 'email'
  | 'priority'
  | 'status'
  | 'request_type'
  | 'root_cause'
  | 'unknown';

export type MondaySchemaColumnRecord = MondaySchemaColumn & {
  boardId: string;
  semanticHint?: MondaySemanticHint;
};

export type MondaySchemaRelation = {
  sourceBoardId: string;
  sourceColumnId: string;
  targetBoardId: string;
  relationType: string;
};

export type MondaySchemaSnapshot = {
  workspaces: MondaySchemaWorkspace[];
  boards: Array<MondaySchemaBoard & { priority: boolean; priorityReason: string }>;
  groups: MondaySchemaGroup[];
  columns: MondaySchemaColumnRecord[];
  relations: MondaySchemaRelation[];
};

export function normalizeSchemaText(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function targetValues(settings: Record<string, unknown>): unknown[] {
  if (Array.isArray(settings.boardIds)) return settings.boardIds;
  if (settings.boardId !== null && settings.boardId !== undefined) return [settings.boardId];
  return [];
}

export function parseBoardRelationTargets(column: MondaySchemaColumn): string[] {
  if (column.type !== 'board_relation') return [];
  const settings = column.settings;
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return [];
  const seen = new Set<string>();
  const values: string[] = [];
  for (const raw of targetValues(settings)) {
    const value = String(raw ?? '').trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    values.push(value);
  }
  return values;
}

export function selectDirectSchemaBoardIds(
  mainBoardId: string,
  relations: MondaySchemaRelation[],
): string[] {
  const normalizedMain = String(mainBoardId);
  const ids = new Set<string>([normalizedMain]);
  for (const relation of relations) {
    if (String(relation.sourceBoardId) !== normalizedMain) continue;
    const target = String(relation.targetBoardId || '').trim();
    if (target) ids.add(target);
  }
  return [...ids];
}

export function classifySemanticHint(column: MondaySchemaColumn): MondaySemanticHint {
  const type = normalizeSchemaText(column.type).replace(/ /g, '_');
  const title = normalizeSchemaText(column.title);

  if (type === 'time_tracking') return 'time_tracking';
  if (type === 'tags') return 'tags';
  if (type === 'email') return 'email';
  if (type === 'files' || type === 'file') return 'file';

  if (title.includes('hardware')) return 'hardware';
  if (title.includes('software')) return 'software';
  if (title.includes('incidente')) return 'incident';
  if (title.includes('satisfacao') || title.includes('nps') || title.includes('pesquisa')) return 'satisfaction';
  if (title.includes('category') || title.includes('categoria')) return 'category';
  if (title.includes('tag')) return 'tags';
  if (title.includes('fornecedor') && (title.includes('link') || title.includes('url'))) return 'supplier_link';
  if (title.includes('fornecedor') && (title.includes('chamado') || title.includes('ticket'))) return 'supplier_ticket';
  if (title.includes('causa raiz')) return 'root_cause';
  if (title.includes('tipo de solicitacao')) return 'request_type';
  if (title === 'prioridade') return 'priority';
  if (title === 'status') return 'status';
  if (title.includes('e mail') || title === 'email') return 'email';
  if (title.includes('nome do funcionario') || title.includes('solicitante')) return 'requester';

  if (type === 'board_relation') return 'board_relation';
  if (type === 'mirror') return 'mirror';
  return 'unknown';
}

const PRIORITY_BOARD_TERMS = [
  'ticket',
  'ti',
  'hardware',
  'software',
  'incidente',
  'satisfacao',
  'nps',
  'pesquisa',
];

export function classifyPriorityBoard(
  board: MondaySchemaBoard,
  mainBoardId: string,
  relatedIds: Set<string>,
): { priority: boolean; reason: string } {
  if (String(board.id) === String(mainBoardId)) {
    return { priority: true, reason: 'board_principal' };
  }
  if (relatedIds.has(String(board.id))) {
    return { priority: true, reason: 'board_relacionado' };
  }
  const name = normalizeSchemaText(board.name);
  const tokens = new Set(name.split(' ').filter(Boolean));
  const relevant = PRIORITY_BOARD_TERMS.some((term) =>
    term === 'ti' ? tokens.has('ti') : name.includes(term),
  );
  return relevant
    ? { priority: true, reason: 'nome_relevante' }
    : { priority: false, reason: '' };
}
