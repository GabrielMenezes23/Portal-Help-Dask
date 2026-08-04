export type RateLimitAction =
  | 'ticket.create'
  | 'ticket.comment'
  | 'ticket.manage';

export type RateLimitPolicy = {
  maxCount: number;
  windowSeconds: number;
};

const POLICIES: Record<RateLimitAction, RateLimitPolicy> = {
  'ticket.create': { maxCount: 5, windowSeconds: 600 },
  'ticket.comment': { maxCount: 20, windowSeconds: 600 },
  'ticket.manage': { maxCount: 60, windowSeconds: 600 },
};

export function getRateLimitPolicy(action: RateLimitAction): RateLimitPolicy {
  return POLICIES[action];
}

export async function consumeRateLimit(
  actorUserId: string,
  action: RateLimitAction,
): Promise<boolean> {
  const { createAdminClient } = await import('@/lib/supabase/admin');
  const policy = getRateLimitPolicy(action);
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc('consume_rate_limit', {
    p_actor_user_id: actorUserId,
    p_action: action,
    p_max_count: policy.maxCount,
    p_window_seconds: policy.windowSeconds,
  });
  if (error) throw new Error(`Falha ao aplicar limite de uso: ${error.message}`);
  return data === true;
}
