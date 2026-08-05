import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { readMondayEnv } from '@/lib/env/server-env';
import { mondayRequest } from './client';

export const OPENING_RESPONSIBLE_COLUMN_ID = 'dropdown_mky7rgr1';

export type OpeningResponsibleOption = {
  id: string;
  label: string;
  normalizedLabel: string;
};

export function normalizeResponsibleLabel(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function parseDropdownSettings(settingsString: string): OpeningResponsibleOption[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(settingsString || '{}');
  } catch {
    return [];
  }
  if (!parsed || typeof parsed !== 'object') return [];
  const labels = (parsed as { labels?: unknown }).labels;
  if (!labels || typeof labels !== 'object' || Array.isArray(labels)) return [];

  const seen = new Set<string>();
  return Object.entries(labels as Record<string, unknown>)
    .map(([id, rawLabel]) => {
      const label = String(rawLabel ?? '').replace(/\s+/g, ' ').trim();
      return { id, label, normalizedLabel: normalizeResponsibleLabel(label) };
    })
    .filter((option) => {
      if (!option.label || !option.normalizedLabel || seen.has(option.normalizedLabel)) return false;
      seen.add(option.normalizedLabel);
      return true;
    })
    .sort((left, right) => left.label.localeCompare(right.label, 'pt-BR'));
}

const BOARD_COLUMN_QUERY = `
  query OpeningResponsibleColumn($boardIds: [ID!]!, $columnIds: [String!]) {
    boards(ids: $boardIds) {
      columns(ids: $columnIds) { id title type settings_str }
    }
  }
`;

export async function fetchOpeningResponsibleOptions(): Promise<OpeningResponsibleOption[]> {
  const { boardId } = readMondayEnv();
  const data = await mondayRequest<{
    boards: Array<{ columns: Array<{ id: string; settings_str: string | null }> }>;
  }>(BOARD_COLUMN_QUERY, {
    boardIds: [boardId],
    columnIds: [OPENING_RESPONSIBLE_COLUMN_ID],
  });
  const column = data.boards?.[0]?.columns?.[0];
  if (!column || column.id !== OPENING_RESPONSIBLE_COLUMN_ID) {
    throw new Error(`Coluna ${OPENING_RESPONSIBLE_COLUMN_ID} não encontrada no Monday.`);
  }
  const options = parseDropdownSettings(String(column.settings_str || '{}'));
  if (options.length === 0) throw new Error('A lista de responsáveis do Monday está vazia.');
  return options;
}

export async function syncOpeningResponsibleOptions(): Promise<{ active: number }> {
  const { boardId } = readMondayEnv();
  const options = await fetchOpeningResponsibleOptions();
  const supabase = createAdminClient();
  const now = new Date().toISOString();

  const { error: upsertError } = await supabase.from('monday_dropdown_options').upsert(
    options.map((option) => ({
      board_id: boardId,
      column_id: OPENING_RESPONSIBLE_COLUMN_ID,
      option_id: option.id,
      option_label: option.label,
      normalized_label: option.normalizedLabel,
      is_active: true,
      last_seen_at: now,
      synced_at: now,
      raw_payload: { source: 'monday_column_settings' },
    })),
    { onConflict: 'board_id,column_id,option_id' },
  );
  if (upsertError) throw new Error(`Falha ao salvar responsáveis: ${upsertError.message}`);

  const activeIds = options.map((option) => option.id);
  const deactivate = await supabase
    .from('monday_dropdown_options')
    .update({ is_active: false, synced_at: now })
    .eq('board_id', boardId)
    .eq('column_id', OPENING_RESPONSIBLE_COLUMN_ID)
    .not('option_id', 'in', `(${activeIds.map((id) => `"${id.replaceAll('"', '')}"`).join(',')})`);
  if (deactivate.error) throw new Error(`Falha ao desativar responsáveis removidos: ${deactivate.error.message}`);

  return { active: options.length };
}

export async function listOpeningResponsibleOptions(): Promise<OpeningResponsibleOption[]> {
  const { boardId } = readMondayEnv();
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('monday_dropdown_options')
    .select('option_id,option_label,normalized_label')
    .eq('board_id', boardId)
    .eq('column_id', OPENING_RESPONSIBLE_COLUMN_ID)
    .eq('is_active', true)
    .order('option_label');
  if (error) throw new Error(`Falha ao carregar responsáveis: ${error.message}`);
  return (data || []).map((row) => ({
    id: String(row.option_id),
    label: String(row.option_label),
    normalizedLabel: String(row.normalized_label),
  }));
}

export function findExactResponsibleMatch(
  requesterName: string,
  options: OpeningResponsibleOption[],
): OpeningResponsibleOption | null {
  const normalized = normalizeResponsibleLabel(requesterName);
  return options.find((option) => option.normalizedLabel === normalized) || null;
}
