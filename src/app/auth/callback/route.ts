import { NextResponse } from 'next/server';

import {
  emailBelongsToAllowedDomain,
  readAllowedMicrosoftEmailDomains,
  sanitizePostLoginPath,
} from '@/lib/auth/microsoft-auth';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const nextPath = sanitizePostLoginPath(url.searchParams.get('next'));

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=microsoft_cancelled', url.origin));
  }

  const supabase = await createClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    return NextResponse.redirect(new URL('/login?error=microsoft_callback', url.origin));
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  const allowedDomains = readAllowedMicrosoftEmailDomains();
  if (userError || !user || !emailBelongsToAllowedDomain(user.email, allowedDomains)) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL('/login?error=unauthorized_domain', url.origin));
  }

  return NextResponse.redirect(new URL(nextPath, url.origin));
}
