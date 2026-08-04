'use server';

import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';

function readField(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === 'string' ? value.trim() : '';
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
