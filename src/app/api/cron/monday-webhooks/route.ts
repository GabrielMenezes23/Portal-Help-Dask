import { timingSafeEqual } from 'node:crypto';

import { NextRequest, NextResponse } from 'next/server';

import { readCronSecret } from '@/lib/env/server-env';
import { ensureMondayWebhooks } from '@/lib/monday/webhook-config';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

function secureEquals(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: NextRequest) {
  let expected: string;
  try {
    expected = readCronSecret();
  } catch {
    return NextResponse.json({ ok: false, error: 'Cron não configurado.' }, { status: 503 });
  }

  const authorization = request.headers.get('authorization') || '';
  const supplied = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!supplied || !secureEquals(supplied, expected)) {
    return NextResponse.json({ ok: false, error: 'Não autorizado.' }, { status: 401 });
  }

  try {
    const result = await ensureMondayWebhooks();
    return NextResponse.json({ ok: true, ...result });
  } catch (cause) {
    console.error('Verificação dos webhooks Monday falhou.', {
      message: cause instanceof Error ? cause.message : String(cause),
    });
    return NextResponse.json(
      { ok: false, error: 'Falha ao verificar webhooks do Monday.' },
      { status: 500 },
    );
  }
}
