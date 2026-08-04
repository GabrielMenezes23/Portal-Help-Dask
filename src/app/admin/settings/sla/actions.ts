'use server';

import { revalidatePath } from 'next/cache';

import { requireAdmin } from '@/lib/auth/current-user';
import { writeAuditEvent } from '@/lib/audit';
import { createAdminClient } from '@/lib/supabase/admin';

export async function updateSlaPolicy(formData: FormData) {
  const { profile } = await requireAdmin();
  const priority = String(formData.get('priority') || '');
  const hours = Number(formData.get('hours'));
  const warningHours = Number(formData.get('warningHours'));
  if (!['critical', 'high', 'medium', 'low'].includes(priority) || !Number.isFinite(hours) || hours <= 0 || !Number.isFinite(warningHours) || warningHours < 0) throw new Error('Parâmetros de SLA inválidos.');
  const supabase = createAdminClient();
  const { error } = await supabase.from('sla_policies').update({ target_business_minutes: Math.round(hours * 60), warning_minutes: Math.round(warningHours * 60) }).eq('priority_key', priority);
  if (error) throw new Error(error.message);
  await writeAuditEvent({ actor: { userId: profile.id, email: profile.email }, action: 'sla.policy.update', entityType: 'sla_policy', entityId: priority, metadata: { hours, warningHours } });
  revalidatePath('/admin/settings/sla');
}

export async function addHoliday(formData: FormData) {
  const { profile } = await requireAdmin(); const date = String(formData.get('date') || ''); const description = String(formData.get('description') || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !description) throw new Error('Feriado inválido.');
  const supabase = createAdminClient(); const { error } = await supabase.from('business_holidays').upsert({ holiday_date: date, description, active: true });
  if (error) throw new Error(error.message);
  await writeAuditEvent({ actor: { userId: profile.id, email: profile.email }, action: 'sla.holiday.upsert', entityType: 'business_holiday', entityId: date, metadata: { description } });
  revalidatePath('/admin/settings/sla');
}
