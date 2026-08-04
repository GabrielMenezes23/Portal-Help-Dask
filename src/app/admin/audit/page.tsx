import type { Metadata } from 'next';

import { AppShell } from '@/components/app-shell';
import { formatDateTime } from '@/components/ticket-ui';
import { requireAdmin } from '@/lib/auth/current-user';
import { getAuditEvents } from '@/lib/tickets/query';

export const metadata: Metadata = { title: 'Auditoria' };
export const dynamic = 'force-dynamic';

type AuditEventRow = { id: string | number; actor_email: string | null; action: string; entity_type: string; entity_id: string | null; success: boolean; created_at: string };

export default async function AuditPage() {
  const { profile } = await requireAdmin(); const events = await getAuditEvents(150);
  return <AppShell active="audit" user={{ email: profile.email, fullName: profile.fullName, role: profile.role }}><section className="page-heading"><div><p className="page-heading__context">Segurança e rastreabilidade</p><h1>Auditoria do sistema</h1><p>Ações relevantes registradas no Supabase, sem armazenar tokens ou senhas.</p></div></section><section className="panel"><div className="audit-table"><div className="audit-row audit-row--head"><span>Data</span><span>Usuário</span><span>Ação</span><span>Entidade</span><span>Resultado</span></div>{(events as AuditEventRow[]).map((event) => <div className="audit-row" key={String(event.id)}><span>{formatDateTime(String(event.created_at))}</span><span>{String(event.actor_email || 'sistema')}</span><strong>{String(event.action)}</strong><span>{String(event.entity_type)} {event.entity_id ? `· ${String(event.entity_id).slice(0, 12)}` : ''}</span><span className={event.success ? 'text-success' : 'text-danger'}>{event.success ? 'Sucesso' : 'Falha'}</span></div>)}</div></section></AppShell>;
}
