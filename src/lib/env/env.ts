export type EnvSource = Record<string, string | undefined>;

export type PublicEnvironment = {
  supabaseUrl: string;
  supabasePublishableKey: string;
};

export type ConfigurationStatus = {
  supabaseUrlConfigured: boolean;
  supabasePublishableKeyConfigured: boolean;
};

function clean(value: string | undefined): string {
  return value?.trim() ?? '';
}

export function readPublicEnv(
  source: EnvSource = process.env,
): PublicEnvironment {
  const supabaseUrl = clean(source.NEXT_PUBLIC_SUPABASE_URL);
  const supabasePublishableKey = clean(
    source.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );

  const missing = [
    !supabaseUrl ? 'NEXT_PUBLIC_SUPABASE_URL' : null,
    !supabasePublishableKey
      ? 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'
      : null,
  ].filter((name): name is string => Boolean(name));

  if (missing.length > 0) {
    throw new Error(
      `Configuração ausente: ${missing.join(', ')}. Consulte o arquivo .env.example.`,
    );
  }

  return { supabaseUrl, supabasePublishableKey };
}

export function getConfigurationStatus(
  source: EnvSource = process.env,
): ConfigurationStatus {
  return {
    supabaseUrlConfigured: Boolean(clean(source.NEXT_PUBLIC_SUPABASE_URL)),
    supabasePublishableKeyConfigured: Boolean(
      clean(source.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
    ),
  };
}
