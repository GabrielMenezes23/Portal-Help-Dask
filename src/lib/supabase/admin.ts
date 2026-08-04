import 'server-only';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';

import { readSupabaseAdminEnv } from '@/lib/env/server-env';

export function createAdminClient() {
  const { supabaseUrl, secretKey } = readSupabaseAdminEnv();

  return createSupabaseClient(supabaseUrl, secretKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}
