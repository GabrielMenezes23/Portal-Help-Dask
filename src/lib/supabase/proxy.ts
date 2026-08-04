import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

import { getConfigurationStatus, readPublicEnv } from '@/lib/env/env';

type CookieToSet = { name: string; value: string; options?: any };

export async function updateSession(request: NextRequest) {
  const status = getConfigurationStatus();

  if (
    !status.supabaseUrlConfigured ||
    !status.supabasePublishableKeyConfigured
  ) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });
  const { supabaseUrl, supabasePublishableKey } = readPublicEnv();

  const supabase = createServerClient(
    supabaseUrl,
    supabasePublishableKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          response = NextResponse.next({ request });

          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  // Atualiza cookies expirados. A autorização real é feita nas páginas/rotas.
  await supabase.auth.getClaims();

  return response;
}
