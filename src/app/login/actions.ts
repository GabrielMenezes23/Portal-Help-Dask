'use server';

import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';

function readField(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === 'string' ? value.trim() : '';
}

export async function loginWithMicrosoft() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (!appUrl) {
    redirect('/login?error=configuration');
  }

  const callbackUrl = new URL('/auth/callback', appUrl);
  callbackUrl.searchParams.set('next', '/app');

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'azure',
    options: {
      redirectTo: callbackUrl.toString(),
      scopes: 'email',
      queryParams: {
        prompt: 'select_account',
      },
    },
  });

  if (error || !data.url) {
    redirect('/login?error=microsoft_unavailable');
  }

  redirect(data.url);
}

export async function login(formData: FormData) {
  const email = readField(formData, 'email').toLowerCase();
  const password = readField(formData, 'password');

  if (!email || !password) {
    redirect('/login?error=required');
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect('/login?error=invalid_credentials');
  }

  redirect('/app');
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
