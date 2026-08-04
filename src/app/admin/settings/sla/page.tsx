import type { Metadata } from 'next';

import { AppShell } from '@/components/app-shell';
import { requireAdmin } from '@/lib/auth/current-user';
import { createClient } from '@/lib/supabase/server';

import { addHoliday, updateSlaPolicy } from './actions';

export const metadata: Metadata = { title: 'SLA e calendário' };
export const dynamic = 'force-dynamic';
type SlaPolicyRow = { priority_key: string; target_business_minutes: number; warning_minutes: number };
type HolidayRow = { holiday_date: string; description: string; active: boolean };

const labels: Record<string, string> = { critical: 'Crítica', high: 'Alta', medium: 'Média', low: 'Baixa' };

export default async function SlaPage() {
  const { profile } = await requireAdmin(); const supabase = await createClient();
  const [policies, holidays] = await Promise.all([supabase.from('sla_policies').select('priority_key,target_business_minutes,warning_minutes').order('target_business_minutes'), supabase.from('business_holidays').select('holiday_date,description,active').eq('active', true).order('holiday_date')]);
  return <AppShell active="sla" user={{ email: profile.email, fullName: profile.fullName, role: profile.role }}><section className="page-heading"><div><p className="page-heading__context">Administração</p><h1>SLA e calendário útil</h1><p>As políticas e os feriados definem o prazo dos novos chamados. Registros legados sem prazo gravado usam a configuração atual; chamados já abertos preservam o prazo calculado na abertura.</p></div></section><div className="content-grid"><section className="panel"><h2>Políticas por prioridade</h2><div className="sla-policy-list">{((policies.data || []) as SlaPolicyRow[]).map((policy) => <form action={updateSlaPolicy} key={policy.priority_key}><input name="priority" type="hidden" value={policy.priority_key} /><strong>{labels[policy.priority_key] || policy.priority_key}</strong><label>Horas úteis<input name="hours" type="number" min="0.5" step="0.5" defaultValue={Number(policy.target_business_minutes) / 60} /></label><label>Alerta antes (h)<input name="warningHours" type="number" min="0" step="0.5" defaultValue={Number(policy.warning_minutes) / 60} /></label><button className="button button--secondary">Salvar</button></form>)}</div></section><section className="panel"><h2>Feriados e paralisações</h2><form action={addHoliday} className="holiday-form"><input name="date" type="date" required /><input name="description" placeholder="Descrição" required /><button className="button button--primary">Adicionar</button></form><div className="holiday-list">{((holidays.data || []) as HolidayRow[]).map((holiday) => <div key={holiday.holiday_date}><strong>{new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(new Date(`${holiday.holiday_date}T00:00:00Z`))}</strong><span>{holiday.description}</span></div>)}</div></section></div></AppShell>;
}
