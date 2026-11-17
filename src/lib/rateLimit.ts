/**
 * In-memory sliding-window rate limiter for one server instance: a quick
 * first check that costs no database read. Each instance keeps its own
 * counts, so the limits that must hold across every instance (sign-in
 * attempts, daily budgets) are in persistentLimit.ts.
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
 * The client's network, for rate-limit keys. Vercel sets x-real-ip itself
 * (clients can't spoof it), so prefer that; x-forwarded-for's first hop is
 * the fallback for other hosts. An IPv6 address is cut to its /64: one
 * connection is usually given a whole /64, so keying on the full address
 * would let a single client rotate through billions of "different" IPs.
 */
export function clientIp(req: Request): string {
  const real = req.headers.get('x-real-ip')?.trim();
  const ip = real || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  return ip.includes(':') ? ipv6Network(ip) : ip;
}

function ipv6Network(ip: string): string {
  const mapped = ip.match(/::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i);
  if (mapped) return mapped[1];
  const [head, tail] = ip.split('::');
  const left = head ? head.split(':') : [];
  const right = tail ? tail.split(':') : [];
  const groups = tail === undefined
    ? left
    : [...left, ...Array(Math.max(0, 8 - left.length - right.length)).fill('0'), ...right];
  return `${groups.slice(0, 4).map(g => (g || '0').toLowerCase().replace(/^0+(?=.)/, '')).join(':')}::/64`;
}
