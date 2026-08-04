import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';

export type AuditActor = {
  userId: string | null;
  email: string;
};

export async function writeAuditEvent(input: {
  actor: AuditActor;
  action: string;
  entityType: string;
  entityId?: string | null;
  success?: boolean;
  errorMessage?: string | null;
  metadata?: Record<string, unknown>;
  requestId?: string | null;
}): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from('audit_events').insert({
    actor_user_id: input.actor.userId,
    actor_email: input.actor.email.toLowerCase(),
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    request_id: input.requestId ?? null,
    success: input.success ?? true,
    error_message: input.errorMessage?.slice(0, 1500) ?? null,
    metadata: input.metadata ?? {},
  });
  if (error) console.error('Falha ao registrar auditoria.', error.message);
}
