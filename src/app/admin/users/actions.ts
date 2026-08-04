'use server';

import { revalidatePath } from 'next/cache';

import { requireAdmin } from '@/lib/auth/current-user';
import { canChangeOwnAdminAccess, isAppRole } from '@/lib/auth/roles';
import { writeAuditEvent } from '@/lib/audit';
import { createAdminClient } from '@/lib/supabase/admin';

export async function updateUserProfile(formData: FormData) {
  const { profile: actor } = await requireAdmin();
  const id = String(formData.get('id') || '');
  const role = String(formData.get('role') || '');
  const active = formData.get('active') === 'on';
  if (!id || !isAppRole(role)) throw new Error('Dados de usuário inválidos.');
  if (id === actor.id && !canChangeOwnAdminAccess({ active, role })) {
    throw new Error('Você não pode remover o próprio acesso administrativo.');
  }
  const supabase = createAdminClient();
  const { error } = await supabase.from('profiles').update({ role, active }).eq('id', id);
  if (error) throw new Error(`Falha ao atualizar usuário: ${error.message}`);
  await writeAuditEvent({ actor: { userId: actor.id, email: actor.email }, action: 'user.access.update', entityType: 'profile', entityId: id, metadata: { role, active } });
  revalidatePath('/admin/users');
}
