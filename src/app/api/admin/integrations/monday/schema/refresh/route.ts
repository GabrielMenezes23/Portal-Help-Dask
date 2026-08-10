import { NextResponse } from 'next/server';

import { authorizeAdminApi } from '@/lib/auth/api-authorization';
import { runMondaySchemaSync } from '@/lib/monday/schema-sync';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST() {
  const authorization = await authorizeAdminApi();
  if (!authorization.ok) return authorization.response;

  try {
    const result = await runMondaySchemaSync({
      triggerSource: 'manual',
      triggeredBy: authorization.actor.userId,
    });
    return NextResponse.json({
      ok: true,
      runId: result.runId,
      summary: {
        workspaces: result.workspaces,
        boards: result.boards,
        groups: result.groups,
        columns: result.columns,
        relations: result.relations,
      },
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (cause) {
    console.error('Inventário manual do Monday falhou.', {
      actor: authorization.actor.email,
      message: cause instanceof Error ? cause.message : 'Falha inesperada.',
    });
    return NextResponse.json(
      { ok: false, error: 'O inventário falhou. Consulte o histórico da integração.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
