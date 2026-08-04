import type { User } from '@supabase/supabase-js';
import { redirect } from 'next/navigation';

import {
  canAccessAdmin,
  canAccessSupport,
  normalizeRole,
  type AppRole,
} from '@/lib/auth/roles';
import { createClient } from '@/lib/supabase/server';

export type Profile = {
  id: string;
  email: string;
  fullName: string | null;
  role: AppRole;
  department: string | null;
  active: boolean;
};

export type CurrentUserContext = {
  user: User;
  profile: Profile | null;
};

export type ActiveUserContext = {
  user: User;
  profile: Profile;
};

type ProfileRow = {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  department: string | null;
  active: boolean;
};

function mapProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    role: normalizeRole(row.role),
    department: row.department,
    active: row.active,
  };
}

export async function getCurrentUserContext(): Promise<CurrentUserContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) return null;

  const { data, error: profileError } = await supabase
    .from('profiles')
    .select('id,email,full_name,role,department,active')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) {
    throw new Error('Não foi possível carregar o perfil do usuário.');
  }

  if (!data) return { user, profile: null };

  return { user, profile: mapProfile(data) };
}

export async function requireActiveUser(): Promise<ActiveUserContext> {
  const context = await getCurrentUserContext();

  if (!context) redirect('/login');
  if (!context.profile) redirect('/forbidden?reason=profile');
  if (!context.profile.active) redirect('/forbidden?reason=inactive');

  return { user: context.user, profile: context.profile };
}


export async function requireSupport(): Promise<ActiveUserContext> {
  const context = await requireActiveUser();

  if (!canAccessSupport(context.profile)) {
    redirect('/forbidden?reason=role');
  }

  return context;
}

export async function requireAdmin(): Promise<ActiveUserContext> {
  const context = await requireActiveUser();

  if (!canAccessAdmin(context.profile)) {
    redirect('/forbidden?reason=role');
  }

  return context;
}
