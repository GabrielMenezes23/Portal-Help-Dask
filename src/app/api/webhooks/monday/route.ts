import { timingSafeEqual } from 'node:crypto';

import { NextResponse } from 'next/server';

import { readMondayWebhookSecret } from '@/lib/env/server-env';
import { processMondayWebhookEvent } from '@/lib/monday/webhook-service';
import { parseMondayWebhook } from '@/lib/monday/webhook';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function secureEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  let expected: string;
  try {
    expected = readMondayWebhookSecret();
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Webhook não configurado.' },
      { status: 503 },
    );
  }
  const url = new URL(request.url);
  const supplied = url.searchParams.get('secret') || request.headers.get('x-monday-webhook-secret') || '';
  if (!secureEqual(supplied, expected)) {
    return NextResponse.json({ ok: false, error: 'Webhook não autorizado.' }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'JSON inválido.' }, { status: 400 });
  }

  try {
    const parsed = parseMondayWebhook(payload);
    if (parsed.kind === 'challenge') return NextResponse.json({ challenge: parsed.challenge });
    const result = await processMondayWebhookEvent(parsed);
    return NextResponse.json({ ok: true, result });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'Falha ao processar webhook.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
