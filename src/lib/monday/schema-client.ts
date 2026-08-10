import 'server-only';

import { mondayRequest } from './client';
import {
  classifyPriorityBoard,
  parseBoardRelationTargets,
  selectDirectSchemaBoardIds,
  type MondaySchemaBoard,
  type MondaySchemaColumn,
  type MondaySchemaColumnRecord,
  type MondaySchemaGroup,
  type MondaySchemaRelation,
  type MondaySchemaSnapshot,
  type MondaySchemaWorkspace,
} from './schema-domain';

const PAGE_SIZE = 100;
const BOARD_BATCH_SIZE = 25;

const WORKSPACES_QUERY = `
  query SchemaWorkspaces($limit: Int!, $page: Int!) {
    workspaces(limit: $limit, page: $page, state: all) {
      id
      name
      description
      kind
      state
    }
  }
`;

const BOARD_STRUCTURES_QUERY = `
  query SchemaBoardStructures($boardIds: [ID!]!) {
    boards(ids: $boardIds) {
      id
      name
      board_kind
      state
      url
      updated_at
      workspace_id
      groups {
        id
        title
        position
        archived
      }
      columns {
        id
        title
        type
        description
        settings
        revision
        archived
      }
    }
  }
`;

const RELATION_BOARDS_QUERY = `
  query SchemaRelationBoards($connectionId: ID!) {
    connection_board_ids(connection_id: $connectionId)
  }
`;

type RawWorkspace = {
  id: string | number | null;
  name: string;
  description?: string | null;
  kind?: string | null;
  state?: string | null;
};

type RawBoard = {
  id: string | number;
  name: string;
  board_kind?: string | null;
  state?: string | null;
  url?: string | null;
  updated_at?: string | null;
  workspace_id?: string | number | null;
  groups?: Array<{
    id: string;
    title: string;
    position?: string | null;
    archived?: boolean | null;
  }>;
  columns?: Array<{
    id: string;
    title: string;
    type: string;
    description?: string | null;
    settings?: Record<string, unknown> | null;
    revision?: string | null;
    archived?: boolean | null;
  }>;
};

function mapWorkspace(raw: RawWorkspace): MondaySchemaWorkspace | null {
  if (raw.id === null || raw.id === undefined) return null;
  const id = String(raw.id).trim();
  if (!id) return null;
  return {
    id,
    name: String(raw.name || '').trim(),
    description: raw.description == null ? null : String(raw.description),
    kind: String(raw.kind || ''),
    state: String(raw.state || ''),
  };
}

function mapBoard(raw: RawBoard): MondaySchemaBoard {
  return {
    id: String(raw.id),
    name: String(raw.name || '').trim(),
    boardKind: String(raw.board_kind || ''),
    state: String(raw.state || ''),
    url: String(raw.url || ''),
    updatedAt: raw.updated_at ? String(raw.updated_at) : null,
    workspaceId: raw.workspace_id === null || raw.workspace_id === undefined
      ? null
      : String(raw.workspace_id),
  };
}

function uniqueById<T extends { id: string }>(rows: T[]): T[] {
  const result = new Map<string, T>();
  for (const row of rows) result.set(row.id, row);
  return [...result.values()];
}

export async function fetchMondayWorkspaces(): Promise<MondaySchemaWorkspace[]> {
  const result: MondaySchemaWorkspace[] = [];
  for (let page = 1; ; page += 1) {
    const data = await mondayRequest<{ workspaces: RawWorkspace[] }>(WORKSPACES_QUERY, {
      limit: PAGE_SIZE,
      page,
    });
    const rows = data.workspaces || [];
    for (const raw of rows) {
      const mapped = mapWorkspace(raw);
      if (mapped) result.push(mapped);
    }
    if (rows.length < PAGE_SIZE) break;
  }
  return uniqueById(result);
}

export async function fetchMondayBoardStructures(
  boardIds: string[],
): Promise<Array<{ board: MondaySchemaBoard; groups: MondaySchemaGroup[]; columns: MondaySchemaColumn[] }>> {
  const result: Array<{ board: MondaySchemaBoard; groups: MondaySchemaGroup[]; columns: MondaySchemaColumn[] }> = [];
  const uniqueIds = [...new Set(boardIds.map(String).filter(Boolean))];

  for (let index = 0; index < uniqueIds.length; index += BOARD_BATCH_SIZE) {
    const batch = uniqueIds.slice(index, index + BOARD_BATCH_SIZE);
    const data = await mondayRequest<{ boards: RawBoard[] }>(BOARD_STRUCTURES_QUERY, {
      boardIds: batch,
    });
    for (const raw of data.boards || []) {
      const board = mapBoard(raw);
      result.push({
        board,
        groups: (raw.groups || []).map((group) => ({
          boardId: board.id,
          id: String(group.id),
          title: String(group.title || '').trim(),
          position: String(group.position || ''),
          archived: Boolean(group.archived),
        })),
        columns: (raw.columns || []).map((column) => ({
          id: String(column.id),
          title: String(column.title || '').trim(),
          type: String(column.type || ''),
          description: column.description == null ? null : String(column.description),
          settings: column.settings && typeof column.settings === 'object'
            ? column.settings
            : {},
          revision: column.revision == null ? null : String(column.revision),
          archived: Boolean(column.archived),
        })),
      });
    }
  }

  return result;
}

export async function resolveMondayRelationTargets(columnId: string): Promise<string[]> {
  const data = await mondayRequest<{ connection_board_ids: Array<string | number> }>(
    RELATION_BOARDS_QUERY,
    { connectionId: columnId },
  );
  return [...new Set((data.connection_board_ids || []).map(String).filter(Boolean))];
}

async function directRelationsFromMainBoard(
  mainBoardId: string,
  columns: MondaySchemaColumn[],
): Promise<MondaySchemaRelation[]> {
  const relations: MondaySchemaRelation[] = [];
  for (const column of columns) {
    if (column.type !== 'board_relation') continue;
    let targets = parseBoardRelationTargets(column);
    if (targets.length === 0) {
      targets = await resolveMondayRelationTargets(column.id);
    }
    for (const targetBoardId of targets) {
      relations.push({
        sourceBoardId: mainBoardId,
        sourceColumnId: column.id,
        targetBoardId,
        relationType: column.type,
      });
    }
  }

  const unique = new Map<string, MondaySchemaRelation>();
  for (const relation of relations) {
    const key = `${relation.sourceBoardId}:${relation.sourceColumnId}:${relation.targetBoardId}`;
    unique.set(key, relation);
  }
  return [...unique.values()];
}

export async function fetchMondaySchemaSnapshot(mainBoardId: string): Promise<MondaySchemaSnapshot> {
  const mainStructures = await fetchMondayBoardStructures([mainBoardId]);
  const main = mainStructures.find((entry) => entry.board.id === String(mainBoardId));
  if (!main) {
    throw new Error(`Board principal ${mainBoardId} não foi encontrado ou não está acessível.`);
  }

  const relations = await directRelationsFromMainBoard(main.board.id, main.columns);
  const scopedBoardIds = selectDirectSchemaBoardIds(main.board.id, relations);
  const targetBoardIds = scopedBoardIds.filter((id) => id !== main.board.id);
  const targetStructures = targetBoardIds.length > 0
    ? await fetchMondayBoardStructures(targetBoardIds)
    : [];
  const structures = [main, ...targetStructures];

  const boards = uniqueById(structures.map((entry) => entry.board));
  const relevantWorkspaceIds = new Set(
    boards.map((board) => board.workspaceId).filter((value): value is string => Boolean(value)),
  );
  const workspaces = (await fetchMondayWorkspaces()).filter((workspace) =>
    relevantWorkspaceIds.has(workspace.id),
  );

  const groups: MondaySchemaGroup[] = structures.flatMap((entry) => entry.groups);
  const columns: MondaySchemaColumnRecord[] = structures.flatMap((entry) =>
    entry.columns.map((column) => ({ ...column, boardId: entry.board.id })),
  );
  const relatedIds = new Set(targetBoardIds);

  return {
    workspaces,
    boards: boards.map((board) => {
      const classification = classifyPriorityBoard(board, main.board.id, relatedIds);
      return { ...board, priority: classification.priority, priorityReason: classification.reason };
    }),
    groups,
    columns,
    relations,
  };
}
