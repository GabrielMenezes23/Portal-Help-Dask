import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getServerConfigurationStatus,
  readCronSecret,
  readMondayEnv,
  readMondayWebhookSecret,
  readPortalTicketDefaults,
  readSupabaseAdminEnv,
} from './server-env.ts';

test('reads server-only integration variables without exposing them', () => {
  assert.deepEqual(
    readMondayEnv({
      MONDAY_API_TOKEN: ' token ',
      MONDAY_API_VERSION: '2026-07',
      MONDAY_BOARD_ID: '18389222247',
    }),
    {
      token: 'token',
      apiVersion: '2026-07',
      boardId: '18389222247',
    },
  );
});

test('requires a Supabase secret key for privileged writes', () => {
  assert.throws(
    () => readSupabaseAdminEnv({ NEXT_PUBLIC_SUPABASE_URL: 'https://x.supabase.co' }),
    /SUPABASE_SECRET_KEY/,
  );
});

test('reports configuration presence only', () => {
  assert.deepEqual(
    getServerConfigurationStatus({
      NEXT_PUBLIC_SUPABASE_URL: 'https://x.supabase.co',
      SUPABASE_SECRET_KEY: 'secret',
      MONDAY_API_TOKEN: '',
      MONDAY_BOARD_ID: '18389222247',
      CRON_SECRET: 'cron',
    }),
    {
      supabaseAdminConfigured: true,
      mondayTokenConfigured: false,
      mondayBoardConfigured: true,
      mondayGroupConfigured: true,
      mondayWebhookSecretConfigured: false,
      cronSecretConfigured: true,
    },
  );
});


test('portal ticket defaults do not require Monday credentials', () => {
  assert.deepEqual(readPortalTicketDefaults({}), {
    boardId: 'portal',
    defaultGroupId: 'portal',
  });
  assert.deepEqual(
    readPortalTicketDefaults({
      MONDAY_BOARD_ID: '18389222247',
      MONDAY_DEFAULT_GROUP_ID: 'topics',
    }),
    { boardId: '18389222247', defaultGroupId: 'topics' },
  );
});


test('exige segredos longos para cron e webhook', () => {
  assert.throws(() => readCronSecret({ CRON_SECRET: 'curto' }), /16 caracteres/i);
  assert.throws(() => readMondayWebhookSecret({ MONDAY_WEBHOOK_SECRET: 'curto' }), /16 caracteres/i);
  assert.equal(readCronSecret({ CRON_SECRET: '1234567890abcdef' }), '1234567890abcdef');
});
