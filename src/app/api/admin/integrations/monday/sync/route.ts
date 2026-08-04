import { NextResponse } from 'next/server';

import { authorizeAdminApi } from '@/lib/auth/api-authorization';
import { runMondaySync } from '@/lib/monday/sync';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST() {
  const authorization = await authorizeAdminApi();
  if (!authorization.ok) return authorization.response;

  try {
    const result = await runMondaySync({
      triggerSource: 'manual',
      triggeredBy: authorization.actor.userId,
    });

    return NextResponse.json(
      {
        ok: true,
        runId: result.runId,
        summary: {
          itemsReceived: result.itemsReceived,
          ticketsUpserted: result.ticketsUpserted,
          attachmentsUpserted: result.attachmentsUpserted,
          ticketsDeactivated: result.ticketsDeactivated,
          attachmentsDeactivated: result.attachmentsDeactivated,
        },
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha inesperada.';
    console.error('Sincronização manual do Monday falhou.', {
      actor: authorization.actor.email,
      message,
    });

    return NextResponse.json(
      {
        ok: false,
        error: 'A sincronização falhou. Consulte o histórico de integrações.',
      },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
