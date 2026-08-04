import 'server-only';

import { NextResponse } from 'next/server';

import { getCurrentUserContext } from './current-user';
import { canAccessAdmin, canAccessSupport } from './roles';

export type ApiActor = {
  userId: string;
  email: string;
  fullName: string | null;
  role: 'requester' | 'ti_agent' | 'admin';
};

export type ApiAuthorization =
  | { ok: true; actor: ApiActor }
  | { ok: false; response: NextResponse };

export async function authorizeActiveApi(): Promise<ApiAuthorization> {
  const context = await getCurrentUserContext();
  if (!context) {
    return { ok: false, response: NextResponse.json({ ok: false, error: 'Autenticação necessária.' }, { status: 401 }) };
  }
  if (!context.profile || !context.profile.active) {
    return { ok: false, response: NextResponse.json({ ok: false, error: 'Perfil inativo ou não provisionado.' }, { status: 403 }) };
  }
  return {
    ok: true,
    actor: {
      userId: context.user.id,
      email: context.profile.email,
      fullName: context.profile.fullName,
      role: context.profile.role,
    },
  };
}

export async function authorizeSupportApi(): Promise<ApiAuthorization> {
  const authorization = await authorizeActiveApi();
  if (!authorization.ok) return authorization;
  if (!canAccessSupport({ role: authorization.actor.role, active: true })) {
    return { ok: false, response: NextResponse.json({ ok: false, error: 'Acesso restrito à equipe de TI.' }, { status: 403 }) };
  }
  return authorization;
}

export async function authorizeAdminApi(): Promise<ApiAuthorization> {
  const authorization = await authorizeActiveApi();
  if (!authorization.ok) return authorization;
  if (!canAccessAdmin({ role: authorization.actor.role, active: true })) {
    return { ok: false, response: NextResponse.json({ ok: false, error: 'Acesso restrito a administradores.' }, { status: 403 }) };
  }
  return authorization;
}
