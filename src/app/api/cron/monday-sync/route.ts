import { timingSafeEqual } from 'node:crypto';

import { NextRequest, NextResponse } from 'next/server';

import { readCronSecret } from '@/lib/env/server-env';
import { runMondaySync } from '@/lib/monday/sync';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

function secureEquals(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

export async function GET(request: NextRequest) {
  let expected: string;

  try {
    expected = readCronSecret();
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Cron não configurado.' },
      { status: 503 },
    );
  }

  const authorization = request.headers.get('authorization') || '';
  const received = authorization.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length)
    : '';

  if (!received || !secureEquals(received, expected)) {
    return NextResponse.json(
      { ok: false, error: 'Não autorizado.' },
      { status: 401 },
    );
  }

  try {
    const result = await runMondaySync({
      triggerSource: 'cron',
      triggeredBy: null,
    });

    return NextResponse.json({
      ok: true,
      runId: result.runId,
      itemsReceived: result.itemsReceived,
      ticketsUpserted: result.ticketsUpserted,
    });
  } catch (error) {
    console.error('Cron Monday falhou.', {
      message: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { ok: false, error: 'Falha na sincronização agendada.' },
      { status: 500 },
    );
  }
}
