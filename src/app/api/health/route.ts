import { NextResponse } from 'next/server';

import { getConfigurationStatus } from '@/lib/env/env';
import { getServerConfigurationStatus } from '@/lib/env/server-env';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const configuration = getConfigurationStatus();
  const serverConfiguration = getServerConfigurationStatus();
  const configured = configuration.supabaseUrlConfigured && configuration.supabasePublishableKeyConfigured && Object.values(serverConfiguration).every(Boolean);
  let database = 'not_checked';
  let storage = 'not_checked';
  if (configured) {
    try {
      const supabase = createAdminClient();
      const [tickets, bucket] = await Promise.all([
        supabase.from('tickets').select('id', { head: true, count: 'exact' }),
        supabase.storage.getBucket('ticket-attachments'),
      ]);
      database = tickets.error ? 'error' : 'ok';
      storage = bucket.error ? 'error' : 'ok';
    } catch {
      database = 'error'; storage = 'error';
    }
  }
  const ready = configured && database === 'ok' && storage === 'ok';
  return NextResponse.json({
    service: 'caf-ti-helpdesk',
    version: '1.0.0',
    phase: 'final-production',
    status: ready ? 'ready' : configured ? 'degraded' : 'configuration_required',
    environment: process.env.NEXT_PUBLIC_APP_ENV || process.env.NODE_ENV,
    checks: { database, storage },
    configuration: { ...configuration, ...serverConfiguration },
    timestamp: new Date().toISOString(),
  }, { status: ready ? 200 : 503, headers: { 'Cache-Control': 'no-store' } });
}
