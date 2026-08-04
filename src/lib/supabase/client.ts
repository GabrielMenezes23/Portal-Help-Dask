import { createBrowserClient } from '@supabase/ssr';

import { readPublicEnv } from '@/lib/env/env';

export function createClient() {
  const { supabaseUrl, supabasePublishableKey } = readPublicEnv();

  return createBrowserClient(supabaseUrl, supabasePublishableKey);
}
