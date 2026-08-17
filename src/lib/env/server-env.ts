import type { EnvSource } from './env.ts';

export type MondayEnvironment = {
  token: string;
  apiVersion: string;
  boardId: string;
};

export type MondayWriteEnvironment = MondayEnvironment & {
  defaultGroupId: string;
  userReplyColumnId: string;
  userFileColumnId: string;
};


export type PortalTicketDefaults = {
  boardId: string;
  defaultGroupId: string;
};

export type SupabaseAdminEnvironment = {
  supabaseUrl: string;
  secretKey: string;
};

export type ServerConfigurationStatus = {
  supabaseAdminConfigured: boolean;
  mondayTokenConfigured: boolean;
  mondayBoardConfigured: boolean;
  mondayGroupConfigured: boolean;
  mondayWebhookSecretConfigured: boolean;
  cronSecretConfigured: boolean;
  resendApiKeyConfigured: boolean;
  notificationFromConfigured: boolean;
};

function clean(value: string | undefined): string {
  return value?.trim() ?? '';
}

function requireValues(entries: Array<[name: string, value: string]>): void {
  const missing = entries.filter(([, value]) => !value).map(([name]) => name);
  if (missing.length > 0) {
    throw new Error(`Configuração server-only ausente: ${missing.join(', ')}.`);
  }
}

export function readMondayEnv(source: EnvSource = process.env): MondayEnvironment {
  const token = clean(source.MONDAY_API_TOKEN);
  const apiVersion = clean(source.MONDAY_API_VERSION) || '2026-07';
  const boardId = clean(source.MONDAY_BOARD_ID);

  requireValues([
    ['MONDAY_API_TOKEN', token],
    ['MONDAY_BOARD_ID', boardId],
  ]);

  if (!/^\d{4}-(01|04|07|10)$/.test(apiVersion)) {
    throw new Error('MONDAY_API_VERSION deve usar o formato AAAA-01/04/07/10.');
  }
  if (!/^\d+$/.test(boardId)) {
    throw new Error('MONDAY_BOARD_ID deve conter somente números.');
  }

  return { token, apiVersion, boardId };
}

export function readMondayWriteEnv(source: EnvSource = process.env): MondayWriteEnvironment {
  const base = readMondayEnv(source);
  const defaultGroupId = clean(source.MONDAY_DEFAULT_GROUP_ID) || 'topics';
  const userReplyColumnId = clean(source.MONDAY_USER_REPLY_COLUMN_ID) || 'long_text_mm12wpxe';
  const userFileColumnId = clean(source.MONDAY_USER_FILE_COLUMN_ID) || 'file4t50hmgx';
  requireValues([['MONDAY_DEFAULT_GROUP_ID', defaultGroupId]]);
  return { ...base, defaultGroupId, userReplyColumnId, userFileColumnId };
}


export function readPortalTicketDefaults(source: EnvSource = process.env): PortalTicketDefaults {
  return {
    boardId: clean(source.MONDAY_BOARD_ID) || 'portal',
    defaultGroupId: clean(source.MONDAY_DEFAULT_GROUP_ID) || 'portal',
  };
}

export function readSupabaseAdminEnv(source: EnvSource = process.env): SupabaseAdminEnvironment {
  const supabaseUrl = clean(source.NEXT_PUBLIC_SUPABASE_URL);
  const secretKey = clean(source.SUPABASE_SECRET_KEY || source.SUPABASE_SERVICE_ROLE_KEY);
  requireValues([
    ['NEXT_PUBLIC_SUPABASE_URL', supabaseUrl],
    ['SUPABASE_SECRET_KEY', secretKey],
  ]);
  return { supabaseUrl, secretKey };
}

function requireLongSecret(name: string, value: string): string {
  requireValues([[name, value]]);
  if (value.length < 16) {
    throw new Error(`${name} deve ter pelo menos 16 caracteres.`);
  }
  return value;
}

export function readCronSecret(source: EnvSource = process.env): string {
  return requireLongSecret('CRON_SECRET', clean(source.CRON_SECRET));
}

export type NotificationEnvironment = {
  apiKey: string;
  fromEmail: string;
};

export function readNotificationEnv(
  source: EnvSource = process.env,
): NotificationEnvironment {
  const apiKey = clean(source.RESEND_API_KEY);
  const fromEmail = clean(source.NOTIFICATION_FROM_EMAIL);
  requireValues([
    ['RESEND_API_KEY', apiKey],
    ['NOTIFICATION_FROM_EMAIL', fromEmail],
  ]);
  return { apiKey, fromEmail };
}

export function readMondayWebhookSecret(source: EnvSource = process.env): string {
  return requireLongSecret(
    'MONDAY_WEBHOOK_SECRET',
    clean(source.MONDAY_WEBHOOK_SECRET),
  );
}

export function getServerConfigurationStatus(source: EnvSource = process.env): ServerConfigurationStatus {
  return {
    supabaseAdminConfigured: Boolean(
      clean(source.NEXT_PUBLIC_SUPABASE_URL) &&
        clean(source.SUPABASE_SECRET_KEY || source.SUPABASE_SERVICE_ROLE_KEY),
    ),
    mondayTokenConfigured: Boolean(clean(source.MONDAY_API_TOKEN)),
    mondayBoardConfigured: Boolean(clean(source.MONDAY_BOARD_ID)),
    mondayGroupConfigured: Boolean(clean(source.MONDAY_DEFAULT_GROUP_ID) || 'topics'),
    mondayWebhookSecretConfigured: Boolean(clean(source.MONDAY_WEBHOOK_SECRET)),
    cronSecretConfigured: Boolean(clean(source.CRON_SECRET)),
    resendApiKeyConfigured: Boolean(clean(source.RESEND_API_KEY)),
    notificationFromConfigured: Boolean(clean(source.NOTIFICATION_FROM_EMAIL)),
  };
}
