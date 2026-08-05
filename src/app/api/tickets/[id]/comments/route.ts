import { NextResponse } from 'next/server';

import { authorizeActiveApi } from '@/lib/auth/api-authorization';
import { createMondayUpdateForPortalComment } from '@/lib/monday/update-sync';
import { consumeRateLimit } from '@/lib/rate-limit';
import { addPortalComment } from '@/lib/tickets/service';
import { validateCommentInput, validateUpload } from '@/lib/tickets/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authorizeActiveApi();
  if (!auth.ok) return auth.response;
  if (!(await consumeRateLimit(auth.actor.userId, 'ticket.comment'))) {
    return NextResponse.json(
      { ok: false, error: 'Limite de comentários atingido. Aguarde alguns minutos.' },
      { status: 429 },
    );
  }
  const { id } = await context.params;
  const form = await request.formData();
  const fileValue = form.get('file');
  const file = fileValue instanceof File && fileValue.size > 0 ? fileValue : null;
  const validation = validateCommentInput({
    message: String(form.get('message') || ''),
    hasFile: Boolean(file),
  });
  if (!validation.ok) {
    return NextResponse.json({ ok: false, errors: validation.errors }, { status: 400 });
  }
  const fileValidation = validateUpload(file);
  if (!fileValidation.ok) {
    return NextResponse.json({ ok: false, errors: fileValidation.errors }, { status: 400 });
  }

  try {
    const result = await addPortalComment({
      actor: auth.actor,
      ticketId: id,
      message: validation.value.message,
      file,
    });
    const mondayUpdate = await createMondayUpdateForPortalComment({
      ticketId: id,
      commentId: result.id,
      authorEmail: auth.actor.email,
      message: validation.value.message,
    });
    return NextResponse.json(
      {
        ok: true,
        ...result,
        mondayUpdateId: mondayUpdate.updateId,
        mondayUpdateError: mondayUpdate.error,
      },
      { status: 201 },
    );
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'Falha ao enviar comentário.';
    const status = /permissão|não encontrado/i.test(message) ? 404 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
