import { redirect } from 'next/navigation';

import { getConfigurationStatus } from '@/lib/env/env';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const configuration = getConfigurationStatus();

  if (
    !configuration.supabaseUrlConfigured ||
    !configuration.supabasePublishableKeyConfigured
  ) {
    redirect('/login?error=configuration');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  redirect(user ? '/app' : '/login');
}
