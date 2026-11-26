/* POST /api/calendar/google/link (curators and vice curators): the address
 * of Google's sign-in page, where a curator signs in as the hub's Google
 * account and allows calendar access. Google then returns to
 * /api/calendar/google/callback. See src/lib/calendarGoogle.ts. */
import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/serverAuth';
import { readJsonBody, siteOrigin } from '@/lib/http';
import { isRateLimited } from '@/lib/rateLimit';
import { SITE_URL } from '@/lib/seo';
import { consentUrl, googleConfigured } from '@/lib/calendarGoogle';

export async function POST(req: NextRequest) {
  const caller = await requireRole(req, ['curator', 'vice_curator']);
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (isRateLimited(`calendar-link:${caller.uid}`, 10, 60_000)) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  if (!googleConfigured()) return NextResponse.json({ error: 'not_configured' }, { status: 503 });
  const body = await readJsonBody(req);
  const locale = body?.locale === 'ar' ? 'ar' : 'en';
  const redirectUri = `${siteOrigin(req, SITE_URL)}/api/calendar/google/callback`;
  return NextResponse.json({ url: consentUrl(caller.uid, locale, redirectUri) });
}
