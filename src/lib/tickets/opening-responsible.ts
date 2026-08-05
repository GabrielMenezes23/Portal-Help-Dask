import 'server-only';

import { readMondayWriteEnv } from '@/lib/env/server-env';
import { mondayRequest } from '@/lib/monday/client';
import {
  OPENING_RESPONSIBLE_COLUMN_ID,
  listOpeningResponsibleOptions,
  normalizeResponsibleLabel,
} from '@/lib/monday/dropdown-options';
import { createAdminClient } from '@/lib/supabase/admin';

const CHANGE_COLUMN_MUTATION = `
  mutation SetOpeningResponsible($boardId: ID!, $itemId: ID!, $columnId: String!, $value: JSON!) {
    change_column_value(
      board_id: $boardId
      item_id: $itemId
      column_id: $columnId
      value: $value
    ) { id }
  }
`;

export async function validateOpeningResponsibleSelection(input: {
  optionId: string;
  label: string;
}): Promise<{ optionId: string; label: string }> {
  const optionId = String(input.optionId || '').trim();
  const label = String(input.label || '').replace(/\s+/g, ' ').trim();
  if (!optionId || !label) throw new Error('Selecione o responsável pela abertura.');

  const options = await listOpeningResponsibleOptions();
  const option = options.find(
    (candidate) =>
      candidate.id === optionId &&
      candidate.normalizedLabel === normalizeResponsibleLabel(label),
  );
  if (!option) throw new Error('O responsável selecionado não está mais disponível. Atualize a página.');
  return { optionId: option.id, label: option.label };
}

export async function assignOpeningResponsible(input: {
  ticketId: string;
  optionId: string;
  label: string;
}): Promise<{ mondaySyncError: string | null }> {
  const supabase = createAdminClient();
  const { data: ticket, error: ticketError } = await supabase
    .from('tickets')
    .select('id,monday_item_id')
    .eq('id', input.ticketId)
    .single();
  if (ticketError || !ticket) {
    throw new Error(`Falha ao localizar o chamado: ${ticketError?.message || 'registro ausente'}`);
  }

  const update = await supabase
    .from('tickets')
    .update({
      opening_responsible_option_id: input.optionId,
      opening_responsible_name: input.label,
      requester_name: input.label,
    })
    .eq('id', input.ticketId);
  if (update.error) throw new Error(`Falha ao salvar o responsável: ${update.error.message}`);

  if (!ticket.monday_item_id) return { mondaySyncError: null };

  try {
    const { boardId } = readMondayWriteEnv();
    await mondayRequest(CHANGE_COLUMN_MUTATION, {
      boardId,
      itemId: String(ticket.monday_item_id),
      columnId: OPENING_RESPONSIBLE_COLUMN_ID,
      value: JSON.stringify({ labels: [input.label] }),
    });
    return { mondaySyncError: null };
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    await supabase
      .from('tickets')
      .update({ external_sync_status: 'failed', external_sync_error: message.slice(0, 1500) })
      .eq('id', input.ticketId);
    return { mondaySyncError: message };
  }
}
