import { NextResponse } from 'next/server';

import { authorizeSupportApi } from '@/lib/auth/api-authorization';
import { consumeRateLimit } from '@/lib/rate-limit';
import { updateTicketManagement } from '@/lib/tickets/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authorizeSupportApi();
  if (!auth.ok) return auth.response;
  if (!(await consumeRateLimit(auth.actor.userId, 'ticket.manage'))) {
    return NextResponse.json({ ok: false, error: 'Limite de alterações atingido. Aguarde alguns minutos.' }, { status: 429 });
  }
  const { id } = await context.params;
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; }
  catch { return NextResponse.json({ ok: false, error: 'JSON inválido.' }, { status: 400 }); }
  const status = String(body.status || '');
  if (!['open', 'in_progress', 'resolved', 'cancelled'].includes(status)) {
    return NextResponse.json({ ok: false, error: 'Status inválido.' }, { status: 400 });
  }
  try {
    const result = await updateTicketManagement({
      actor: auth.actor,
      ticketId: id,
      status: status as 'open' | 'in_progress' | 'resolved' | 'cancelled',
      rootCause: String(body.rootCause || ''),
      currentUpdate: String(body.currentUpdate || ''),
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (cause) {
    return NextResponse.json({ ok: false, error: cause instanceof Error ? cause.message : 'Falha ao atualizar chamado.' }, { status: 500 });
  }
}
