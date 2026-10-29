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

/** True for a post sent from another website's page (its Origin header
 *  names a different site), e.g. a hidden form submitting in a visitor's
 *  browser. The site's own pages, and tools that send no Origin at all,
 *  pass; those still face every other check. */
export function isCrossSite(req: Request): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return false;
  try {
    return new URL(origin).host !== req.headers.get('host');
  } catch {
    return true;
  }
}
