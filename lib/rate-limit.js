import supabaseAdmin from './db';

// Fixed-window rate limiting backed by the rate_limits table (see
// supabase/migrations/006_rate_limits.sql). A key is allowed MAX_ATTEMPTS
// failed attempts per WINDOW_MS; a successful attempt clears its key so
// legitimate users aren't penalized for earlier typos.
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

export function rateLimitKey(scope, identifier) {
  return `${scope}:${identifier.trim().toLowerCase()}`;
}

// Returns true if this key has burned through its attempts within the
// current window. A missing row, a Supabase error, or an expired window
// all count as "not limited" — an outage should fail open here rather
// than lock everybody out.
export async function isRateLimited(key) {
  const { data, error } = await supabaseAdmin
    .from('rate_limits')
    .select('attempt_count, window_start')
    .eq('key', key)
    .maybeSingle();

  if (error || !data) return false;

  const windowStart = data.window_start ? new Date(data.window_start).getTime() : 0;
  const windowExpired = Date.now() - windowStart >= WINDOW_MS;
  return !windowExpired && (data.attempt_count || 0) >= MAX_ATTEMPTS;
}

// Records a failed attempt. If the stored window is still open the count is
// incremented; if it expired the row resets to a fresh window with count 1.
export async function recordFailedAttempt(key) {
  const { data } = await supabaseAdmin
    .from('rate_limits')
    .select('attempt_count, window_start')
    .eq('key', key)
    .maybeSingle();

  const windowStart = data?.window_start ? new Date(data.window_start).getTime() : 0;
  const windowExpired = Date.now() - windowStart >= WINDOW_MS;

  const attemptCount = data && !windowExpired ? (data.attempt_count || 0) + 1 : 1;
  const windowStartIso = data && !windowExpired ? data.window_start : new Date().toISOString();

  await supabaseAdmin
    .from('rate_limits')
    .upsert({ key, attempt_count: attemptCount, window_start: windowStartIso });
}

// Clears the key after a successful attempt.
export async function clearRateLimit(key) {
  await supabaseAdmin.from('rate_limits').delete().eq('key', key);
}
