export type SlaState =
  | 'unavailable'
  | 'open_within'
  | 'open_warning'
  | 'open_breach'
  | 'resolved_ok'
  | 'resolved_late';

export type BusinessSegment = readonly [startMinute: number, endMinute: number];

export type SlaCalendar = {
  segmentsByWeekday?: Partial<Record<number, ReadonlyArray<BusinessSegment>>>;
  holidays?: ReadonlySet<string>;
};

const SAO_PAULO_OFFSET_MINUTES = -180;
const DAY_MS = 86_400_000;
const DEFAULT_WORK_SEGMENTS: ReadonlyArray<BusinessSegment> = [
  [7 * 60 + 42, 13 * 60],
  [14 * 60, 17 * 60],
];

function toLocalParts(date: Date) {
  const shifted = new Date(date.getTime() + SAO_PAULO_OFFSET_MINUTES * 60_000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
    weekday: shifted.getUTCDay(),
    minuteOfDay: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
  };
}

function localDateKey(date: Date): string {
  const parts = toLocalParts(date);
  return `${parts.year}-${String(parts.month + 1).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

function fromLocal(
  year: number,
  month: number,
  day: number,
  minuteOfDay: number,
): Date {
  const utc =
    Date.UTC(year, month, day, 0, minuteOfDay) -
    SAO_PAULO_OFFSET_MINUTES * 60_000;
  return new Date(utc);
}

function localDayStart(date: Date): Date {
  const parts = toLocalParts(date);
  return fromLocal(parts.year, parts.month, parts.day, 0);
}

function nextLocalDay(date: Date): Date {
  return new Date(localDayStart(date).getTime() + DAY_MS);
}

function segmentsForDay(
  date: Date,
  calendar: SlaCalendar,
): ReadonlyArray<BusinessSegment> {
  const weekday = toLocalParts(date).weekday;
  const configured = calendar.segmentsByWeekday?.[weekday];
  if (configured) return configured;
  return weekday >= 1 && weekday <= 5 ? DEFAULT_WORK_SEGMENTS : [];
}

function isBusinessDay(date: Date, calendar: SlaCalendar): boolean {
  if (calendar.holidays?.has(localDateKey(date))) return false;
  return segmentsForDay(date, calendar).length > 0;
}

function nextBusinessStart(date: Date, calendar: SlaCalendar): Date {
  let cursor = date;
  for (let guard = 0; guard < 370; guard += 1) {
    const parts = toLocalParts(cursor);
    const segments = segmentsForDay(cursor, calendar);
    if (isBusinessDay(cursor, calendar)) {
      for (const [start, end] of segments) {
        if (parts.minuteOfDay < start) {
          return fromLocal(parts.year, parts.month, parts.day, start);
        }
        if (parts.minuteOfDay >= start && parts.minuteOfDay < end) {
          return cursor;
        }
      }
    }
    cursor = nextLocalDay(cursor);
  }
  throw new Error('Não foi possível encontrar o próximo horário útil.');
}

export function addBusinessMinutes(
  start: Date,
  minutes: number,
  calendar: SlaCalendar = {},
): Date {
  if (!Number.isFinite(minutes) || minutes < 0) {
    throw new Error('Minutos úteis inválidos.');
  }
  let remaining = Math.round(minutes);
  let cursor = nextBusinessStart(new Date(start), calendar);

  while (remaining > 0) {
    cursor = nextBusinessStart(cursor, calendar);
    const parts = toLocalParts(cursor);
    const segment = segmentsForDay(cursor, calendar).find(
      ([segmentStart, segmentEnd]) =>
        parts.minuteOfDay >= segmentStart && parts.minuteOfDay < segmentEnd,
    );
    if (!segment) {
      cursor = nextBusinessStart(new Date(cursor.getTime() + 60_000), calendar);
      continue;
    }
    const available = segment[1] - parts.minuteOfDay;
    if (remaining <= available) {
      return new Date(cursor.getTime() + remaining * 60_000);
    }
    remaining -= available;
    cursor = new Date(cursor.getTime() + (available + 1) * 60_000);
  }

  return cursor;
}

export function prioritySlaMinutes(priority: string): number | null {
  const normalized = priority.trim().toLowerCase();
  if (normalized === 'critical') return 240;
  if (normalized === 'high') return 960;
  if (normalized === 'medium') return 1920;
  if (normalized === 'low') return 6000;
  return null;
}

export function classifySla(input: {
  deadline: Date | null;
  resolvedAt?: Date | null;
  now?: Date;
  warningMinutes?: number;
}): SlaState {
  if (!input.deadline) return 'unavailable';
  const now = input.now ?? new Date();
  if (input.resolvedAt) {
    return input.resolvedAt.getTime() <= input.deadline.getTime()
      ? 'resolved_ok'
      : 'resolved_late';
  }
  if (now.getTime() > input.deadline.getTime()) return 'open_breach';
  const warningMinutes = input.warningMinutes ?? 120;
  return input.deadline.getTime() - now.getTime() <= warningMinutes * 60_000
    ? 'open_warning'
    : 'open_within';
}
