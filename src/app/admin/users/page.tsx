import type { Metadata } from 'next';

import { AppShell } from '@/components/app-shell';
import { requireAdmin } from '@/lib/auth/current-user';
import { createAdminClient } from '@/lib/supabase/admin';

import { updateUserProfile } from './actions';

export const metadata: Metadata = { title: 'Usuários e acessos' };
export const dynamic = 'force-dynamic';

type UserProfileRow = { id: string; email: string; full_name: string | null; role: string; department: string | null; active: boolean; created_at: string };

export default async function UsersPage() {
  const { profile } = await requireAdmin(); const supabase = createAdminClient();
  const { data, error } = await supabase.from('profiles').select('id,email,full_name,role,department,active,created_at').order('email');
  if (error) throw new Error(error.message);
  return <AppShell active="users" user={{ email: profile.email, fullName: profile.fullName, role: profile.role }}><section className="page-heading"><div><p className="page-heading__context">Administração</p><h1>Usuários e acessos</h1><p>Contas são criadas no Supabase Auth. Nesta tela, a TI controla papel e ativação.</p></div></section><section className="panel"><div className="user-admin-list">{((data || []) as UserProfileRow[]).map((user) => <form action={updateUserProfile} className="user-admin-row" key={user.id}><input name="id" type="hidden" value={user.id} /><div><strong>{user.full_name || user.email}</strong><small>{user.email}</small></div><select name="role" defaultValue={user.role}><option value="requester">Solicitante</option><option value="ti_agent">Equipe de TI</option><option value="admin">Administrador</option></select><label className="checkbox-label"><input name="active" type="checkbox" defaultChecked={user.active} /> Ativo</label><button className="button button--secondary" type="submit">Salvar</button></form>)}</div></section></AppShell>;
}
