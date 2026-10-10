/**
 * Best-effort in-memory sliding-window rate limiter for a single Next.js
 * instance. Not distributed — a multi-instance/serverless deployment with
 * many concurrent cold starts won't share this state, so it's a speed bump
 * against casual abuse, not a hard guarantee. A KV-backed limiter (Upstash/
 * Vercel KV) is the correct fix if traffic/abuse actually grows; this repo
 * has no such store configured today.
 */
const hits = new Map<string, number[]>();

/** Bound the map so a flood of distinct IPs can't grow memory without limit. */
const MAX_KEYS = 5000;
let lastSweep = 0;

function sweep(now: number, windowMs: number) {
  if (now - lastSweep < windowMs && hits.size < MAX_KEYS) return;
  lastSweep = now;
  for (const [key, stamps] of hits) {
    if (!stamps.length || now - stamps[stamps.length - 1] >= windowMs) hits.delete(key);
  }
  // Still over budget (sustained flood): drop the oldest entries.
  if (hits.size > MAX_KEYS) {
    const excess = hits.size - MAX_KEYS;
    let i = 0;
    for (const key of hits.keys()) { if (i++ >= excess) break; hits.delete(key); }
  }
}

export function isRateLimited(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  sweep(now, windowMs);
  const timestamps = (hits.get(key) ?? []).filter(t => now - t < windowMs);
  if (timestamps.length >= limit) {
    hits.set(key, timestamps);
    return true;
  }
  timestamps.push(now);
  hits.set(key, timestamps);
  return false;
}

/**
 * The client's IP. Vercel sets x-real-ip itself (clients can't spoof it), so
 * prefer that; x-forwarded-for's first hop is the fallback for other hosts.
 */
export function clientIp(req: Request): string {
  const real = req.headers.get('x-real-ip')?.trim();
  if (real) return real;
  const forwarded = req.headers.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() || 'unknown';
}
