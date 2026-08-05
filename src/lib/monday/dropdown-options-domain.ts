export type OpeningResponsibleOption = {
  id: string;
  label: string;
  normalizedLabel: string;
};

export function normalizeResponsibleLabel(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function parseDropdownSettings(settingsString: string): OpeningResponsibleOption[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(settingsString || '{}');
  } catch {
    return [];
  }
  if (!parsed || typeof parsed !== 'object') return [];
  const labels = (parsed as { labels?: unknown }).labels;
  if (!labels || typeof labels !== 'object' || Array.isArray(labels)) return [];

  const seen = new Set<string>();
  return Object.entries(labels as Record<string, unknown>)
    .map(([id, rawLabel]) => {
      const label = String(rawLabel ?? '').replace(/\s+/g, ' ').trim();
      return { id, label, normalizedLabel: normalizeResponsibleLabel(label) };
    })
    .filter((option) => {
      if (!option.label || !option.normalizedLabel || seen.has(option.normalizedLabel)) return false;
      seen.add(option.normalizedLabel);
      return true;
    })
    .sort((left, right) => left.label.localeCompare(right.label, 'pt-BR'));
}

export function findExactResponsibleMatch(
  requesterName: string,
  options: OpeningResponsibleOption[],
): OpeningResponsibleOption | null {
  const normalized = normalizeResponsibleLabel(requesterName);
  return options.find((option) => option.normalizedLabel === normalized) || null;
}
