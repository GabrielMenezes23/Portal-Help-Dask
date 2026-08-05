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

function parseSettings(value: unknown): Record<string, unknown> | null {
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value || '{}');
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : null;
    } catch {
      return null;
    }
  }

  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function extractLabelEntries(labels: unknown): Array<{ id: string; label: string }> {
  if (Array.isArray(labels)) {
    return labels.flatMap((entry) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
      const record = entry as Record<string, unknown>;
      if (record.is_deactivated === true || record.isDeactivated === true) return [];
      return [{
        id: String(record.id ?? '').trim(),
        label: String(record.label ?? record.name ?? '').replace(/\s+/g, ' ').trim(),
      }];
    });
  }

  if (labels && typeof labels === 'object') {
    return Object.entries(labels as Record<string, unknown>).map(([id, rawLabel]) => ({
      id,
      label: String(rawLabel ?? '').replace(/\s+/g, ' ').trim(),
    }));
  }

  return [];
}

export function parseDropdownSettings(settings: unknown): OpeningResponsibleOption[] {
  const parsed = parseSettings(settings);
  if (!parsed) return [];

  const seenIds = new Set<string>();
  const seenLabels = new Set<string>();
  return extractLabelEntries(parsed.labels)
    .map(({ id, label }) => ({
      id,
      label,
      normalizedLabel: normalizeResponsibleLabel(label),
    }))
    .filter((option) => {
      if (
        !option.id ||
        !option.label ||
        !option.normalizedLabel ||
        seenIds.has(option.id) ||
        seenLabels.has(option.normalizedLabel)
      ) {
        return false;
      }
      seenIds.add(option.id);
      seenLabels.add(option.normalizedLabel);
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
