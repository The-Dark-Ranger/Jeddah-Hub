/* GET /api/calendar/google/callback: where Google sends the curator back
 * after they allow (or refuse) calendar access. Saves the link and returns
 * to the Calendar page, which says how it went (?google=…). */
import { NextRequest, NextResponse } from 'next/server';
import { siteOrigin } from '@/lib/http';
import { SITE_URL } from '@/lib/seo';
import { finishLink, readState, syncCalendar } from '@/lib/calendarGoogle';

export async function GET(req: NextRequest) {
  const origin = siteOrigin(req, SITE_URL);
  const q = req.nextUrl.searchParams;
  const state = readState(q.get('state') ?? '');
  const back = (result: string) => NextResponse.redirect(`${origin}/${state?.locale ?? 'en'}/dashboard/shaper/calendar?google=${result}`, 303);
  const code = q.get('code');
  // No state: not a link this site started (or older than 10 minutes).
  if (!state) return back('failed');
  if (!code) return back(q.get('error') === 'access_denied' ? 'cancelled' : 'failed');
  const result = await finishLink(code, `${origin}/api/calendar/google/callback`, state.uid).catch(err => {
    console.error('[calendar] linking failed', err);
    return 'failed' as const;
  });
  // Events added while it wasn't linked get their invites now.
  if (result === 'linked') await syncCalendar().catch(err => console.error('[calendar] first sync failed', err));
  return back(result);
}
