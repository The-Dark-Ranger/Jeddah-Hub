import type { NextRequest } from 'next/server';

/**
 * Reads a request's JSON body defensively. Returns null, instead of throwing
 * an unhandled 500, for a missing/oversized body, malformed JSON, or anything
 * that isn't a plain object, so every route can answer bad input with a 400.
 */
export async function readJsonBody(
  req: NextRequest,
  maxBytes = 16 * 1024,
): Promise<Record<string, unknown> | null> {
  const declared = Number(req.headers.get('content-length') ?? 0);
  if (declared > maxBytes) return null;
  try {
    const text = await req.text();
    if (!text || text.length > maxBytes) return null;
    const parsed: unknown = JSON.parse(text);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/** The site address a request came to, for links in the emails it sends:
 *  a preview's links open that preview (whose own Firebase project issued
 *  any code in them), and anything unexpected falls back to `fallback`. */
export function siteOrigin(req: NextRequest, fallback: string): string {
  const host = req.headers.get('host') ?? '';
  if (/^(localhost|127\.0\.0\.1)(:\d{2,5})?$/.test(host)) return `http://${host}`;
  return /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(host) ? `https://${host.toLowerCase()}` : fallback;
}

/** A trimmed string no longer than `max`, or null for any other type. */
export function asString(value: unknown, max = 500): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed && trimmed.length <= max ? trimmed : null;
}
