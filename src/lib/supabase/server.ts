import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

import { readPublicEnv } from '@/lib/env/env';

type CookieToSet = { name: string; value: string; options?: any };

export async function createClient() {
  const cookieStore = await cookies();
  const { supabaseUrl, supabasePublishableKey } = readPublicEnv();

  return createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components não podem gravar cookies. O Proxy atualiza a sessão.
        }
      },
    },
  });
}
