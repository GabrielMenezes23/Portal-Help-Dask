import { NextResponse } from 'next/server';

import { authorizeActiveApi } from '@/lib/auth/api-authorization';
import { consumeRateLimit } from '@/lib/rate-limit';
import { listTickets } from '@/lib/tickets/query';
import { createPortalTicket } from '@/lib/tickets/service';
import { validateNewTicketInput, validateUpload } from '@/lib/tickets/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await authorizeActiveApi();
  if (!auth.ok) return auth.response;
  const url = new URL(request.url);
  try {
    const result = await listTickets({
      query: url.searchParams.get('q') || '',
      status: url.searchParams.get('status') || '',
      priority: url.searchParams.get('priority') || '',
      requestType: url.searchParams.get('type') || '',
      dateFrom: url.searchParams.get('from') || '',
      dateTo: url.searchParams.get('to') || '',
      page: Number(url.searchParams.get('page') || 1),
      pageSize: Number(url.searchParams.get('pageSize') || 20),
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (cause) {
    return NextResponse.json({ ok: false, error: cause instanceof Error ? cause.message : 'Falha ao consultar chamados.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await authorizeActiveApi();
  if (!auth.ok) return auth.response;
  if (!(await consumeRateLimit(auth.actor.userId, 'ticket.create'))) {
    return NextResponse.json({ ok: false, error: 'Limite de abertura de chamados atingido. Aguarde alguns minutos.' }, { status: 429 });
  }
  const form = await request.formData();
  const validation = validateNewTicketInput({
    title: String(form.get('title') || ''),
    description: String(form.get('description') || ''),
    priority: String(form.get('priority') || ''),
    requestType: String(form.get('requestType') || ''),
    justification: String(form.get('justification') || ''),
  });
  if (!validation.ok) return NextResponse.json({ ok: false, errors: validation.errors }, { status: 400 });
  const fileValue = form.get('file');
  const file = fileValue instanceof File && fileValue.size > 0 ? fileValue : null;
  const fileValidation = validateUpload(file);
  if (!fileValidation.ok) return NextResponse.json({ ok: false, errors: fileValidation.errors }, { status: 400 });

  try {
    const result = await createPortalTicket({ actor: auth.actor, ticket: validation.value, file });
    return NextResponse.json({ ok: true, ...result }, { status: 201 });
  } catch (cause) {
    return NextResponse.json({ ok: false, error: cause instanceof Error ? cause.message : 'Falha ao criar chamado.' }, { status: 500 });
  }
}
