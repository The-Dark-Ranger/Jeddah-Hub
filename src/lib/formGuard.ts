/* Shared by the public form routes (contact, newsletter, activity forms,
 * the sign-in and email checks). */
import { NextResponse } from 'next/server';

/** A JSON response with a status code. */
export const json = (body: unknown, status = 200) => NextResponse.json(body, { status });

/** True for a submission a bot sent: the hidden honeypot field is filled, or
 *  the form was sent faster than a person could fill it in (or the timing
 *  is missing). Routes answer these with a quiet success and keep nothing,
 *  so the bot learns nothing. */
export function isBotSubmission(body: Record<string, unknown> | null, minFillMs: number): boolean {
  const elapsed = Number(body?.elapsedMs);
  return !!body?.website || !Number.isFinite(elapsed) || elapsed < minFillMs;
}

/** True for a request sent from another website's page, e.g. a hidden form
 *  submitting in a visitor's browser while they're signed in here. The
 *  browser says so itself (Sec-Fetch-Site, which pages can't set), and the
 *  Origin it sends names the other site. The site's own pages, and tools
 *  that send neither header, pass; those still face every other check.
 *  proxy.ts applies this to every change (POST, PUT, PATCH, DELETE) before
 *  any route runs; the form routes check it again themselves. */
export function isCrossSite(req: Request): boolean {
  const fetchSite = req.headers.get('sec-fetch-site');
  if (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'none') return true;
  const origin = req.headers.get('origin');
  if (!origin) return false;
  try {
    return new URL(origin).host !== req.headers.get('host');
  } catch {
    return true; // "null" (a sandboxed frame) or garbage
  }
}
