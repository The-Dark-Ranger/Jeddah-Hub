/**
 * Best-effort in-memory sliding-window rate limiter for a single Next.js
 * instance. Not distributed — a multi-instance/serverless deployment with
 * many concurrent cold starts won't share this state, so it's a speed bump
 * against casual abuse, not a hard guarantee. A KV-backed limiter (Upstash/
 * Vercel KV) is the correct fix if traffic/abuse actually grows; this repo
 * has no such store configured today.
 */
const hits = new Map<string, number[]>();

export function isRateLimited(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const timestamps = (hits.get(key) ?? []).filter(t => now - t < windowMs);
  if (timestamps.length >= limit) {
    hits.set(key, timestamps);
    return true;
  }
  timestamps.push(now);
  hits.set(key, timestamps);
  return false;
}

export function clientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() || 'unknown';
}
