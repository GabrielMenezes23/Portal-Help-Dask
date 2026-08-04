import { NextResponse } from 'next/server';

import { authorizeAdminApi } from '@/lib/auth/api-authorization';
import { retryPendingMondaySync } from '@/lib/tickets/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  const auth = await authorizeAdminApi();
  if (!auth.ok) return auth.response;
  try {
    const result = await retryPendingMondaySync(auth.actor);
    return NextResponse.json({ ok: true, result });
  } catch (cause) {
    return NextResponse.json({ ok: false, error: cause instanceof Error ? cause.message : 'Falha ao reprocessar pendências.' }, { status: 500 });
  }
}
