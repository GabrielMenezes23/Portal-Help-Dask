import 'server-only';

import { readMondayEnv, readMondayWriteEnv } from '@/lib/env/server-env';

import {
  MONDAY_COLUMN_ID_LIST,
  MONDAY_GROUP_ID_LIST,
  extractAssetIds,
  type MondayAsset,
  type MondayItem,
} from './domain';
import type { MondaySnapshot } from './sync-workflow';
import {
  appendUniqueMondayText,
  commentDedupeMarker,
  markedMondayFileName,
  mondayAttachmentMarker,
} from './write-model';

const MONDAY_API_URL = 'https://api.monday.com/v2';
const PAGE_SIZE = 100;
const ASSET_BATCH_SIZE = 50;
const MAX_ATTEMPTS = 3;

const FIRST_PAGE_QUERY = `
  query BoardItems(
    $boardIds: [ID!]!
    $limit: Int!
    $columnIds: [String!]
  ) {
    boards(ids: $boardIds) {
      items_page(limit: $limit) {
        cursor
        items {
          id
          name
          created_at
          updated_at
          group { id title }
          column_values(ids: $columnIds) {
            id
            text
            value
            type
            ... on TimeTrackingValue { duration }
          }
        }
      }
    }
  }
`;

const NEXT_PAGE_QUERY = `
  query NextBoardItems(
    $cursor: String!
    $limit: Int!
    $columnIds: [String!]
  ) {
    next_items_page(cursor: $cursor, limit: $limit) {
      cursor
      items {
        id
        name
        created_at
        updated_at
        group { id title }
        column_values(ids: $columnIds) {
          id
          text
          value
          type
          ... on TimeTrackingValue { duration }
        }
      }
    }
  }
`;

const ASSETS_QUERY = `
  query Assets($assetIds: [ID!]!) {
    assets(ids: $assetIds) {
      id
      name
      url
      public_url
    }
  }
`;

type GraphQlEnvelope<T> = {
  data?: T;
  errors?: Array<{ message?: string; extensions?: { code?: string } }>;
};

type ItemsPage = {
  cursor: string | null;
  items: MondayItem[];
};

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function mondayRequest<T>(
  query: string,
  variables: Record<string, unknown>,
): Promise<T> {
  const { token, apiVersion } = readMondayEnv();
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(MONDAY_API_URL, {
        method: 'POST',
        headers: {
          Authorization: token,
          'API-Version': apiVersion,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query, variables }),
        cache: 'no-store',
        signal: AbortSignal.timeout(30_000),
      });

      const raw = await response.text();
      let envelope: GraphQlEnvelope<T>;

      try {
        envelope = JSON.parse(raw) as GraphQlEnvelope<T>;
      } catch {
        throw new Error(`Monday retornou conteúdo inválido (HTTP ${response.status}).`);
      }

      if (!response.ok || envelope.errors?.length) {
        const detail = envelope.errors
          ?.map((error) => error.message || error.extensions?.code || 'erro GraphQL')
          .join('; ');
        const error = new Error(
          detail || `Monday API retornou HTTP ${response.status}.`,
        );

        if (response.status === 429 || response.status >= 500) {
          lastError = error;
          if (attempt < MAX_ATTEMPTS) {
            await sleep(500 * 2 ** (attempt - 1));
            continue;
          }
        }

        throw error;
      }

      if (!envelope.data) {
        throw new Error('Monday API não retornou o campo data.');
      }

      return envelope.data;
    } catch (cause) {
      const error = cause instanceof Error ? cause : new Error(String(cause));
      lastError = error;

      if (attempt < MAX_ATTEMPTS && error.name === 'TimeoutError') {
        await sleep(500 * 2 ** (attempt - 1));
        continue;
      }

      if (attempt >= MAX_ATTEMPTS || error.name !== 'TimeoutError') {
        throw error;
      }
    }
  }

  throw lastError || new Error('Falha desconhecida ao consultar o Monday.');
}

async function fetchAllItems(boardId: string): Promise<MondayItem[]> {
  const first = await mondayRequest<{
    boards: Array<{ items_page: ItemsPage | null }>;
  }>(FIRST_PAGE_QUERY, {
    boardIds: [boardId],
    limit: PAGE_SIZE,
    columnIds: MONDAY_COLUMN_ID_LIST,
  });

  const page = first.boards[0]?.items_page;
  if (!page) throw new Error('Board do Monday não encontrado ou sem acesso.');

  const items = [...page.items];
  let cursor = page.cursor;

  while (cursor) {
    const next = await mondayRequest<{ next_items_page: ItemsPage | null }>(
      NEXT_PAGE_QUERY,
      {
        cursor,
        limit: PAGE_SIZE,
        columnIds: MONDAY_COLUMN_ID_LIST,
      },
    );

    if (!next.next_items_page) break;
    items.push(...next.next_items_page.items);
    cursor = next.next_items_page.cursor;
  }

  const allowedGroups = new Set(MONDAY_GROUP_ID_LIST);
  return items.filter((item) => allowedGroups.has(String(item.group?.id ?? '')));
}

async function fetchAssets(assetIds: string[]): Promise<Map<string, MondayAsset>> {
  const assets = new Map<string, MondayAsset>();

  for (let index = 0; index < assetIds.length; index += ASSET_BATCH_SIZE) {
    const batch = assetIds.slice(index, index + ASSET_BATCH_SIZE);
    const data = await mondayRequest<{ assets: MondayAsset[] }>(ASSETS_QUERY, {
      assetIds: batch,
    });

    for (const asset of data.assets || []) {
      assets.set(String(asset.id), asset);
    }
  }

  return assets;
}

export async function fetchMondaySnapshot(): Promise<MondaySnapshot> {
  const { boardId } = readMondayEnv();
  const items = await fetchAllItems(boardId);
  const assetIds = [...new Set(items.flatMap((item) => extractAssetIds(item.column_values)))];
  const assets = await fetchAssets(assetIds);

  return { boardId, items, assets };
}

const SINGLE_ITEM_QUERY = `
  query SingleItem($itemIds: [ID!]!, $columnIds: [String!]) {
    items(ids: $itemIds) {
      id
      name
      created_at
      updated_at
      group { id title }
      column_values(ids: $columnIds) {
        id
        text
        value
        type
        ... on TimeTrackingValue { duration }
      }
    }
  }
`;

const CREATE_ITEM_MUTATION = `
  mutation CreatePortalTicket(
    $boardId: ID!
    $groupId: String!
    $itemName: String!
    $columnValues: JSON!
  ) {
    create_item(
      board_id: $boardId
      group_id: $groupId
      item_name: $itemName
      column_values: $columnValues
    ) { id name }
  }
`;

const CURRENT_REPLY_QUERY = `
  query CurrentReply($itemIds: [ID!]!, $columnId: [String!]) {
    items(ids: $itemIds) {
      id
      column_values(ids: $columnId) { id text value }
    }
  }
`;

const CURRENT_FILES_QUERY = `
  query CurrentFiles($itemIds: [ID!]!, $columnId: [String!]) {
    items(ids: $itemIds) {
      id
      column_values(ids: $columnId) { id value }
    }
  }
`;

const CHANGE_COLUMN_MUTATION = `
  mutation ChangeColumn($boardId: ID!, $itemId: ID!, $columnId: String!, $value: JSON!) {
    change_column_value(
      board_id: $boardId
      item_id: $itemId
      column_id: $columnId
      value: $value
    ) { id }
  }
`;

export async function fetchMondayItemSnapshot(itemId: string): Promise<MondaySnapshot> {
  const { boardId } = readMondayEnv();
  const data = await mondayRequest<{ items: MondayItem[] }>(SINGLE_ITEM_QUERY, {
    itemIds: [itemId],
    columnIds: MONDAY_COLUMN_ID_LIST,
  });
  const item = data.items?.[0];
  if (!item) throw new Error(`Item ${itemId} não foi encontrado no Monday.`);
  const assetIds = extractAssetIds(item.column_values);
  const assets = await fetchAssets(assetIds);
  return { boardId, items: [item], assets };
}

export async function createMondayItem(input: {
  title: string;
  columnValues: Record<string, unknown>;
}): Promise<{ id: string; name: string }> {
  const { boardId, defaultGroupId } = readMondayWriteEnv();
  const data = await mondayRequest<{ create_item: { id: string; name: string } }>(
    CREATE_ITEM_MUTATION,
    {
      boardId,
      groupId: defaultGroupId,
      itemName: input.title,
      columnValues: JSON.stringify(input.columnValues),
    },
  );
  if (!data.create_item?.id) throw new Error('Monday não retornou o ID do chamado criado.');
  return { id: String(data.create_item.id), name: String(data.create_item.name || input.title) };
}

export async function appendMondayUserReply(
  itemId: string,
  appendBlock: string,
  commentId?: string,
): Promise<string> {
  const { boardId, userReplyColumnId } = readMondayWriteEnv();
  const current = await mondayRequest<{
    items: Array<{ column_values: Array<{ text?: string }> }>;
  }>(CURRENT_REPLY_QUERY, {
    itemIds: [itemId],
    columnId: [userReplyColumnId],
  });
  const existing = String(current.items?.[0]?.column_values?.[0]?.text || '').trim();
  const marker = commentId ? commentDedupeMarker(commentId) : '';
  const next = appendUniqueMondayText(existing, appendBlock, marker);
  if (!next.changed) return next.text;
  await mondayRequest(CHANGE_COLUMN_MUTATION, {
    boardId,
    itemId,
    columnId: userReplyColumnId,
    value: JSON.stringify({ text: next.text }),
  });
  return next.text;
}

async function findExistingMondayAttachment(
  itemId: string,
  columnId: string,
  marker: string,
): Promise<string | null> {
  const current = await mondayRequest<{
    items: Array<{ column_values: Array<{ value?: string }> }>;
  }>(CURRENT_FILES_QUERY, {
    itemIds: [itemId],
    columnId: [columnId],
  });

  const rawValue = current.items?.[0]?.column_values?.[0]?.value;
  if (!rawValue) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawValue);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;

  const files = Array.isArray((parsed as { files?: unknown[] }).files)
    ? (parsed as { files: Array<Record<string, unknown>> }).files
    : [];
  const assetIds = files
    .map((file) => file.assetId ?? file.asset_id ?? file.id)
    .filter((value): value is string | number => value !== null && value !== undefined)
    .map(String);
  if (assetIds.length === 0) return null;

  const assets = await fetchAssets(assetIds);
  for (const asset of assets.values()) {
    if (String(asset.name || '').includes(marker)) return String(asset.id);
  }
  return null;
}

export async function uploadMondayFile(input: {
  itemId: string;
  fileName: string;
  mimeType: string;
  bytes: ArrayBuffer;
  attachmentId?: string;
}): Promise<string> {
  const { token, apiVersion, userFileColumnId } = readMondayWriteEnv();
  let uploadName = input.fileName;
  if (input.attachmentId) {
    const marker = mondayAttachmentMarker(input.attachmentId);
    const existingAssetId = await findExistingMondayAttachment(
      input.itemId,
      userFileColumnId,
      marker,
    );
    if (existingAssetId) return existingAssetId;
    uploadName = markedMondayFileName(input.attachmentId, input.fileName);
  }

  const query = `
    mutation UploadPortalFile($file: File!, $itemId: ID!, $columnId: String!) {
      add_file_to_column(file: $file, item_id: $itemId, column_id: $columnId) { id }
    }
  `;
  const form = new FormData();
  form.append('query', query);
  form.append('variables', JSON.stringify({ itemId: input.itemId, columnId: userFileColumnId, file: null }));
  form.append(
    'file',
    new Blob([input.bytes], { type: input.mimeType || 'application/octet-stream' }),
    uploadName,
  );

  const response = await fetch('https://api.monday.com/v2/file', {
    method: 'POST',
    headers: { Authorization: token, 'API-Version': apiVersion },
    body: form,
    cache: 'no-store',
    signal: AbortSignal.timeout(60_000),
  });
  const raw = await response.text();
  let envelope: GraphQlEnvelope<{ add_file_to_column: { id: string } }>;
  try {
    envelope = JSON.parse(raw) as GraphQlEnvelope<{ add_file_to_column: { id: string } }>;
  } catch {
    throw new Error(`Monday retornou conteúdo inválido no upload (HTTP ${response.status}).`);
  }
  if (!response.ok || envelope.errors?.length || !envelope.data?.add_file_to_column?.id) {
    const detail = envelope.errors?.map((error) => error.message || 'erro GraphQL').join('; ');
    throw new Error(detail || `Falha ao enviar arquivo ao Monday (HTTP ${response.status}).`);
  }
  return String(envelope.data.add_file_to_column.id);
}

const CHANGE_MULTIPLE_COLUMNS_MUTATION = `
  mutation ChangeMultipleColumns($boardId: ID!, $itemId: ID!, $columnValues: JSON!) {
    change_multiple_column_values(
      board_id: $boardId
      item_id: $itemId
      column_values: $columnValues
    ) { id }
  }
`;

export async function updateMondayTicketFields(input: {
  itemId: string;
  status: 'open' | 'in_progress' | 'resolved' | 'cancelled';
  rootCause: string;
  currentUpdate: string;
}): Promise<void> {
  const { boardId } = readMondayWriteEnv();
  const statusLabels = {
    open: 'Aberto',
    in_progress: 'Em andamento',
    resolved: 'Resolvido',
    cancelled: 'Cancelado',
  } as const;
  await mondayRequest(CHANGE_MULTIPLE_COLUMNS_MUTATION, {
    boardId,
    itemId: input.itemId,
    columnValues: JSON.stringify({
      status95: { label: statusLabels[input.status] },
      long_text_mkx84r4n: { text: input.rootCause },
      text_mm0qa8s9: input.currentUpdate,
      date6: input.status === 'resolved'
        ? { date: new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }) }
        : null,
    }),
  });
}
