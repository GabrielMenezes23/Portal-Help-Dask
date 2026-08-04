export const MONDAY_GROUPS = {
  topics: 'Tickets não atribuídos',
  group_title: 'Tickets abertos',
  new_group: 'Tickets resolvidos',
  group_mm0z7g4s: 'Tickets bloqueados',
  group_mkyss0vv: 'Tickets cancelados',
} as const;

export const MONDAY_COLUMN_IDS = {
  email: 'email',
  openedAt: 'date',
  resolvedAt: 'date6',
  description: 'long_text7',
  responsible: 'people0',
  status: 'status95',
  priority: 'priority',
  priorityJustification: 'long_textzr7lt7g8',
  requestType: 'request_type',
  rootCause: 'long_text_mkx84r4n',
  currentUpdate: 'text_mm0qa8s9',
  requesterName: 'dropdown_mky7rgr1',
  legacyFiles: 'file_mm12mh4c',
  userReply: 'long_text_mm12wpxe',
  userFiles: 'file4t50hmgx',
} as const;

export const MONDAY_COLUMN_ID_LIST = Object.values(MONDAY_COLUMN_IDS);
export const MONDAY_GROUP_ID_LIST = Object.keys(MONDAY_GROUPS);

export type TicketStatusBucket = 'open' | 'in_progress' | 'resolved' | 'cancelled';
export type TicketPriorityKey = 'critical' | 'high' | 'medium' | 'low' | 'unknown';

export type MondayColumnValue = {
  id: string;
  text: string | null;
  value: string | null;
  type?: string | null;
};

export type MondayItem = {
  id: string;
  name: string;
  created_at?: string | null;
  updated_at?: string | null;
  group?: {
    id: string;
    title: string;
  } | null;
  column_values: MondayColumnValue[];
};

export type MondayAsset = {
  id: string;
  name: string | null;
  url: string | null;
  public_url?: string | null;
  file_extension?: string | null;
  file_size?: number | null;
  created_at?: string | null;
};

export type TicketUpsert = {
  board_id: string;
  monday_item_id: string;
  title: string;
  group_external_id: string;
  group_name: string;
  status_raw: string;
  status_bucket: TicketStatusBucket;
  priority_raw: string;
  priority_key: TicketPriorityKey;
  requester_name: string;
  requester_email: string;
  responsible_name: string;
  request_type: string;
  priority_justification: string;
  root_cause: string;
  current_update: string;
  description: string;
  user_reply_raw: string;
  opened_at: string | null;
  resolved_at: string | null;
  source_created_at: string | null;
  source_updated_at: string | null;
  source_active: boolean;
  last_seen_at: string;
  last_synced_at: string;
  last_sync_run_id: string;
  raw_payload: MondayItem;
};

export type MappedMondayItem = {
  ticket: TicketUpsert;
  assetIds: string[];
};

function normalized(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function normalizeStatusBucket(
  status: string | null | undefined,
  groupId: string | null | undefined,
): TicketStatusBucket {
  const statusKey = normalized(status);
  const groupKey = String(groupId ?? '').trim();

  if (groupKey === 'group_mkyss0vv' || statusKey.includes('cancel')) {
    return 'cancelled';
  }

  if (
    groupKey === 'new_group' ||
    statusKey.includes('resolvid') ||
    statusKey.includes('fech') ||
    statusKey.includes('conclu') ||
    statusKey.includes('self resolved')
  ) {
    return 'resolved';
  }

  if (
    groupKey === 'group_mm0z7g4s' ||
    statusKey.includes('andamento') ||
    statusKey.includes('progres') ||
    statusKey.includes('bloque') ||
    statusKey.includes('pend')
  ) {
    return 'in_progress';
  }

  return 'open';
}

export function normalizePriority(
  priority: string | null | undefined,
): TicketPriorityKey {
  const key = normalized(priority);

  if (key.includes('critic')) return 'critical';
  if (key.includes('alta') || key === 'high') return 'high';
  if (key.includes('media') || key === 'medium') return 'medium';
  if (key.includes('baixa') || key === 'low') return 'low';
  return 'unknown';
}

export function parseMondayDate(value: unknown): string | null {
  const raw = String(value ?? '').trim();
  if (!raw) return null;

  const br = raw.match(
    /^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/,
  );

  if (br) {
    const [, day, month, year, hour = '00', minute = '00'] = br;
    const parsed = new Date(
      `${year}-${month}-${day}T${hour.padStart(2, '0')}:${minute}:00-03:00`,
    );
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }

  const isoDateOnly = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoDateOnly) {
    const parsed = new Date(`${raw}T00:00:00.000Z`);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function parseColumnValue(column: MondayColumnValue): unknown {
  if (!column.value) return null;

  try {
    return JSON.parse(column.value);
  } catch {
    return null;
  }
}

function columnMap(columns: MondayColumnValue[]): Map<string, MondayColumnValue> {
  return new Map(columns.map((column) => [column.id, column]));
}

function columnText(
  columns: Map<string, MondayColumnValue>,
  id: string,
): string {
  const column = columns.get(id);
  const direct = String(column?.text ?? '').trim();
  if (direct) return direct;

  const parsed = column ? parseColumnValue(column) : null;
  if (parsed && typeof parsed === 'object') {
    const record = parsed as Record<string, unknown>;
    const fallback = record.text ?? record.email ?? record.date;
    if (typeof fallback === 'string') return fallback.trim();
  }

  return '';
}

export function extractAssetIds(columns: MondayColumnValue[]): string[] {
  const allowed = new Set<string>([
    MONDAY_COLUMN_IDS.legacyFiles,
    MONDAY_COLUMN_IDS.userFiles,
  ]);
  const ids = new Set<string>();

  for (const column of columns) {
    if (!allowed.has(column.id)) continue;

    const parsed = parseColumnValue(column);
    if (!parsed || typeof parsed !== 'object') continue;

    const files = (parsed as { files?: unknown }).files;
    if (!Array.isArray(files)) continue;

    for (const file of files) {
      if (!file || typeof file !== 'object') continue;
      const record = file as Record<string, unknown>;
      const value = record.assetId ?? record.asset_id ?? record.id;
      const id = String(value ?? '').trim();
      if (id) ids.add(id);
    }
  }

  return [...ids];
}

export function mapMondayItem(
  item: MondayItem,
  boardId: string,
  runId: string,
  syncedAt: Date = new Date(),
): MappedMondayItem {
  const columns = columnMap(item.column_values);
  const groupId = String(item.group?.id ?? '').trim();
  const groupName =
    String(item.group?.title ?? '').trim() ||
    MONDAY_GROUPS[groupId as keyof typeof MONDAY_GROUPS] ||
    'Grupo não identificado';
  const statusRaw = columnText(columns, MONDAY_COLUMN_IDS.status);
  const priorityRaw = columnText(columns, MONDAY_COLUMN_IDS.priority);
  const timestamp = syncedAt.toISOString();

  return {
    ticket: {
      board_id: boardId,
      monday_item_id: String(item.id),
      title: String(item.name ?? '').trim(),
      group_external_id: groupId,
      group_name: groupName,
      status_raw: statusRaw,
      status_bucket: normalizeStatusBucket(statusRaw, groupId),
      priority_raw: priorityRaw,
      priority_key: normalizePriority(priorityRaw),
      requester_name: columnText(columns, MONDAY_COLUMN_IDS.requesterName),
      requester_email: columnText(columns, MONDAY_COLUMN_IDS.email).toLowerCase(),
      responsible_name: columnText(columns, MONDAY_COLUMN_IDS.responsible),
      request_type: columnText(columns, MONDAY_COLUMN_IDS.requestType),
      priority_justification: columnText(
        columns,
        MONDAY_COLUMN_IDS.priorityJustification,
      ),
      root_cause: columnText(columns, MONDAY_COLUMN_IDS.rootCause),
      current_update: columnText(columns, MONDAY_COLUMN_IDS.currentUpdate),
      description: columnText(columns, MONDAY_COLUMN_IDS.description),
      user_reply_raw: columnText(columns, MONDAY_COLUMN_IDS.userReply),
      opened_at:
        parseMondayDate(columnText(columns, MONDAY_COLUMN_IDS.openedAt)) ??
        parseMondayDate(item.created_at),
      resolved_at: parseMondayDate(
        columnText(columns, MONDAY_COLUMN_IDS.resolvedAt),
      ),
      source_created_at: parseMondayDate(item.created_at),
      source_updated_at: parseMondayDate(item.updated_at),
      source_active: true,
      last_seen_at: timestamp,
      last_synced_at: timestamp,
      last_sync_run_id: runId,
      raw_payload: item,
    },
    assetIds: extractAssetIds(item.column_values),
  };
}
