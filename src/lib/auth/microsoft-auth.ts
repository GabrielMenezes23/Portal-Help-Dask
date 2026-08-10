export function normalizeAllowedEmailDomains(
  value: string | undefined,
): string[] {
  return [...new Set(
    (value ?? '')
      .split(',')
      .map((domain) => domain.trim().toLowerCase().replace(/^@/, ''))
      .filter(Boolean),
  )];
}

export function emailBelongsToAllowedDomain(
  email: string | null | undefined,
  allowedDomains: readonly string[],
): boolean {
  const normalizedEmail = email?.trim().toLowerCase() ?? '';
  const separator = normalizedEmail.lastIndexOf('@');

  if (separator <= 0 || separator === normalizedEmail.length - 1) {
    return false;
  }

  const domain = normalizedEmail.slice(separator + 1);
  return allowedDomains.some((allowed) => domain === allowed.toLowerCase());
}

export function sanitizePostLoginPath(
  value: string | null | undefined,
): string {
  const candidate = value?.trim() ?? '';

  if (!candidate.startsWith('/') || candidate.startsWith('//')) {
    return '/app';
  }

  return candidate;
}

export function resolveMicrosoftOAuthOrigin(
  source: Record<string, string | undefined> = process.env,
): string {
  if (source.VERCEL_ENV?.trim() === 'preview') {
    const previewHost = source.VERCEL_URL?.trim()
      .replace(/^https?:\/\//i, '')
      .replace(/\/+$/, '');

    if (previewHost) {
      return `https://${previewHost}`;
    }
  }

  return source.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, '') ?? '';
}

export function readAllowedMicrosoftEmailDomains(
  source: Record<string, string | undefined> = process.env,
): string[] {
  const configured = normalizeAllowedEmailDomains(
    source.MICROSOFT_ALLOWED_EMAIL_DOMAINS,
  );

  return configured.length > 0 ? configured : ['cafmaquinas.com.br'];
}
