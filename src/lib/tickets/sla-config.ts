import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  prioritySlaMinutes,
  type BusinessSegment,
  type SlaCalendar,
} from './sla';

export type SlaPolicy = {
  targetBusinessMinutes: number;
  warningMinutes: number;
};

export type RuntimeSlaConfiguration = {
  policies: Map<string, SlaPolicy>;
  calendar: SlaCalendar;
};

type PolicyRow = {
  priority_key: string;
  target_business_minutes: number;
  warning_minutes: number;
};

type BusinessHourRow = {
  weekday: number;
  start_time: string;
  end_time: string;
};

type HolidayRow = { holiday_date: string };

function timeToMinutes(value: string): number {
  const match = String(value).match(/^(\d{1,2}):(\d{2})/);
  if (!match) throw new Error(`Horário útil inválido: ${value}`);
  return Number(match[1]) * 60 + Number(match[2]);
}

export async function loadSlaConfiguration(
  supabase: SupabaseClient,
): Promise<RuntimeSlaConfiguration> {
  const [policiesResult, hoursResult, holidaysResult] = await Promise.all([
    supabase
      .from('sla_policies')
      .select('priority_key,target_business_minutes,warning_minutes')
      .eq('active', true),
    supabase
      .from('business_hours')
      .select('weekday,start_time,end_time,segment_order')
      .eq('active', true)
      .order('weekday')
      .order('segment_order'),
    supabase
      .from('business_holidays')
      .select('holiday_date')
      .eq('active', true),
  ]);

  const error =
    policiesResult.error || hoursResult.error || holidaysResult.error;
  if (error) {
    throw new Error(`Não foi possível carregar a configuração de SLA: ${error.message}`);
  }

  const policies = new Map<string, SlaPolicy>();
  for (const row of (policiesResult.data || []) as PolicyRow[]) {
    policies.set(String(row.priority_key), {
      targetBusinessMinutes: Number(row.target_business_minutes),
      warningMinutes: Number(row.warning_minutes),
    });
  }

  const segmentsByWeekday: Partial<
    Record<number, ReadonlyArray<BusinessSegment>>
  > = {};
  const mutableSegments = new Map<number, BusinessSegment[]>(
    Array.from({ length: 7 }, (_, weekday) => [weekday, []]),
  );
  for (const row of (hoursResult.data || []) as BusinessHourRow[]) {
    const weekday = Number(row.weekday);
    const segment: BusinessSegment = [
      timeToMinutes(row.start_time),
      timeToMinutes(row.end_time),
    ];
    const current = mutableSegments.get(weekday) || [];
    current.push(segment);
    mutableSegments.set(weekday, current);
  }
  for (const [weekday, segments] of mutableSegments) {
    segmentsByWeekday[weekday] = segments;
  }

  return {
    policies,
    calendar: {
      segmentsByWeekday,
      holidays: new Set(
        ((holidaysResult.data || []) as HolidayRow[]).map((row) =>
          String(row.holiday_date),
        ),
      ),
    },
  };
}

export function getSlaPolicy(
  configuration: RuntimeSlaConfiguration,
  priority: string,
): SlaPolicy | null {
  const configured = configuration.policies.get(priority);
  if (configured) return configured;
  const fallback = prioritySlaMinutes(priority);
  return fallback == null
    ? null
    : { targetBusinessMinutes: fallback, warningMinutes: 120 };
}
