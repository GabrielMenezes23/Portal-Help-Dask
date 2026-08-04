import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getConfigurationStatus,
  readPublicEnv,
} from './env.ts';

test('reads and trims required public Supabase variables', () => {
  const result = readPublicEnv({
    NEXT_PUBLIC_SUPABASE_URL: ' https://example.supabase.co ',
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: ' sb_publishable_test ',
  });

  assert.deepEqual(result, {
    supabaseUrl: 'https://example.supabase.co',
    supabasePublishableKey: 'sb_publishable_test',
  });
});

test('throws without exposing values when configuration is missing', () => {
  assert.throws(
    () => readPublicEnv({ NEXT_PUBLIC_SUPABASE_URL: '' }),
    /NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/,
  );
});

test('reports only configuration presence', () => {
  assert.deepEqual(
    getConfigurationStatus({
      NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: '',
    }),
    {
      supabaseUrlConfigured: true,
      supabasePublishableKeyConfigured: false,
    },
  );
});
