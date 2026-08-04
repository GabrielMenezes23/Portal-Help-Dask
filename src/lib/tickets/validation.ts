export const TICKET_PRIORITIES = ['critical', 'high', 'medium', 'low'] as const;
export type TicketPriorityInput = (typeof TICKET_PRIORITIES)[number];

export type NewTicketInput = {
  title: string;
  description: string;
  priority: string;
  requestType: string;
  justification: string;
};

export type ValidNewTicket = {
  title: string;
  description: string;
  priority: TicketPriorityInput;
  requestType: string;
  justification: string;
};

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; errors: Record<string, string> };

function clean(value: unknown, maxLength: number): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

export function validateNewTicketInput(input: NewTicketInput): ValidationResult<ValidNewTicket> {
  const title = clean(input.title, 160);
  const description = clean(input.description, 6000);
  const requestType = clean(input.requestType, 120);
  const justification = clean(input.justification, 1200);
  const priority = String(input.priority ?? '').trim().toLowerCase();
  const errors: Record<string, string> = {};

  if (title.length < 5) errors.title = 'Informe um título com pelo menos 5 caracteres.';
  if (description.length < 10) errors.description = 'Descreva o problema com pelo menos 10 caracteres.';
  if (!requestType) errors.requestType = 'Selecione o tipo de solicitação.';
  if (!TICKET_PRIORITIES.includes(priority as TicketPriorityInput)) {
    errors.priority = 'Selecione uma prioridade válida.';
  }
  if ((priority === 'critical' || priority === 'high') && !justification) {
    errors.justification = 'A justificativa é obrigatória para prioridade Crítica ou Alta.';
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      title,
      description,
      priority: priority as TicketPriorityInput,
      requestType,
      justification,
    },
  };
}


export function normalizeManagementText(value: unknown): string {
  return String(value ?? '').trim().slice(0, 4000);
}

export function validateCommentInput(input: {
  message: string;
  hasFile: boolean;
}): ValidationResult<{ message: string }> {
  const message = String(input.message ?? '').trim().slice(0, 6000);
  if (!message && !input.hasFile) {
    return { ok: false, errors: { message: 'Escreva um comentário ou selecione um arquivo.' } };
  }
  return { ok: true, value: { message } };
}

export function validateUpload(file: File | null, maxBytes = 8 * 1024 * 1024): ValidationResult<File | null> {
  if (!file || file.size === 0) return { ok: true, value: null };
  if (file.size > maxBytes) {
    return { ok: false, errors: { file: 'O arquivo deve ter no máximo 8 MB.' } };
  }
  const forbiddenMimeTypes = [
    'application/x-msdownload',
    'application/x-sh',
    'application/x-bat',
  ];
  const forbiddenExtensions = new Set([
    'bat', 'cmd', 'com', 'exe', 'js', 'jse', 'msi', 'ps1', 'scr', 'sh', 'vbs',
  ]);
  const extension = file.name.toLowerCase().split('.').pop() || '';
  if (forbiddenMimeTypes.includes(file.type) || forbiddenExtensions.has(extension)) {
    return { ok: false, errors: { file: 'Este tipo de arquivo não é permitido.' } };
  }
  return { ok: true, value: file };
}
