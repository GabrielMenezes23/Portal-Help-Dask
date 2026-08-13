import type { TicketPriorityInput } from '../tickets/validation.ts';

const PRIORITY_LABELS: Record<TicketPriorityInput, string> = {
  critical: 'Crítica',
  high: 'Alta',
  medium: 'Média',
  low: 'Baixa',
};

export type MondayCreateValuesInput = {
  email: string;
  openedDate: string;
  description: string;
  priority: TicketPriorityInput;
  requestType: string;
  justification: string;
};

export type MondayManagedStatus = 'open' | 'in_progress' | 'resolved' | 'cancelled';

const MONDAY_STATUS_LABELS: Record<MondayManagedStatus, string> = {
  open: 'Novo',
  in_progress: 'Em andamento',
  resolved: 'Resolvido',
  cancelled: 'Cancelado',
};

export function mondayManagedStatusLabel(status: MondayManagedStatus): string {
  return MONDAY_STATUS_LABELS[status];
}

export function buildCreateItemColumnValues(input: MondayCreateValuesInput): Record<string, unknown> {
  const values: Record<string, unknown> = {
    email: { email: input.email, text: input.email },
    date: { date: input.openedDate },
    long_text7: { text: input.description },
    priority: { label: PRIORITY_LABELS[input.priority] },
    request_type: { labels: [input.requestType] },
    status95: { label: mondayManagedStatusLabel('open') },
  };

  if (input.justification) {
    values.long_textzr7lt7g8 = { text: input.justification };
  }

  return values;
}

export function pendingTicketSyncMode(
  mondayItemId: string | null | undefined,
): 'create' | 'update' {
  return mondayItemId ? 'update' : 'create';
}

export function shouldUpdateMondayTicketFields(input: {
  status: MondayManagedStatus;
  rootCause: string;
  currentUpdate: string;
}): boolean {
  return (
    input.status !== 'open' ||
    input.rootCause.trim().length > 0 ||
    input.currentUpdate.trim().length > 0
  );
}

export function mondayAttachmentMarker(attachmentId: string): string {
  return `CAF-ATTACHMENT-${attachmentId}`;
}

export function mondayFileUploadMultipartFields(input: {
  itemId: string;
  columnId: string;
}): {
  fileField: '0';
  map: string;
  variables: string;
} {
  return {
    fileField: '0',
    map: JSON.stringify({ '0': ['variables.file'] }),
    variables: JSON.stringify({
      itemId: input.itemId,
      columnId: input.columnId,
      file: null,
    }),
  };
}

export function markedMondayFileName(
  attachmentId: string,
  originalName: string,
): string {
  return `${mondayAttachmentMarker(attachmentId)}--${originalName}`;
}

export function commentDedupeMarker(commentId: string): string {
  return `[CAF-COMMENT:${commentId}]`;
}

export function appendUniqueMondayText(
  existingText: string,
  appendBlock: string,
  dedupeMarker: string,
): { text: string; changed: boolean } {
  const existing = existingText.trim();
  if (dedupeMarker && existing.includes(dedupeMarker)) {
    return { text: existing, changed: false };
  }
  return {
    text: existing ? `${existing}\n\n${appendBlock}` : appendBlock,
    changed: true,
  };
}

export function formatPortalCommentBlock(input: {
  authorEmail: string;
  message: string;
  commentId?: string;
  timestamp?: Date;
}): string {
  const timestamp = input.timestamp ?? new Date();
  const formatted = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'America/Sao_Paulo',
  }).format(timestamp).replace(',', '');
  const marker = input.commentId ? `\n${commentDedupeMarker(input.commentId)}` : '';
  return `🗨️ ${formatted} — ${input.authorEmail}\n${input.message || '(anexo sem texto)'}${marker}`;
}
