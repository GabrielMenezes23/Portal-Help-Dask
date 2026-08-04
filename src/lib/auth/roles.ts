export const APP_ROLES = ['requester', 'ti_agent', 'admin'] as const;
export type AppRole = (typeof APP_ROLES)[number];

export type AdminAccessSubject = { role: AppRole; active: boolean };

export function isAppRole(value: unknown): value is AppRole {
  return typeof value === 'string' && APP_ROLES.includes(value as AppRole);
}

export function normalizeRole(value: unknown): AppRole {
  if (typeof value !== 'string') return 'requester';
  const normalized = value.trim().toLowerCase();
  return isAppRole(normalized) ? normalized : 'requester';
}

export function canAccessSupport(subject: AdminAccessSubject | null | undefined): boolean {
  return Boolean(subject?.active && (subject.role === 'ti_agent' || subject.role === 'admin'));
}

export function canAccessAdmin(subject: AdminAccessSubject | null | undefined): boolean {
  return Boolean(subject?.active && subject.role === 'admin');
}

export function canChangeOwnAdminAccess(subject: AdminAccessSubject): boolean {
  return subject.active && subject.role === 'admin';
}
