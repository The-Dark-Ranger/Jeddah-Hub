/* POST /api/calendar/sync (any member): brings the hub's Google Calendar in
 * line with the database after a member saves or deletes an event (`id`),
 * and every few minutes checks everything and reads the replies. It only
 * copies what the database already holds, and firestore.rules decided who
 * could write that, so any member may ask. See src/lib/calendarGoogle.ts. */
import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/serverAuth';
import { readJsonBody } from '@/lib/http';
import { isRateLimited } from '@/lib/rateLimit';
import { syncCalendar } from '@/lib/calendarGoogle';

const MEMBERS = ['curator', 'vice_curator', 'impact_officer', 'shaper', 'alumni'];

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const caller = await requireRole(req, MEMBERS);
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (isRateLimited(`calendar-sync:${caller.uid}`, 30, 60_000)) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  const body = await readJsonBody(req, 1024);
  const id = typeof body?.id === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(body.id) ? body.id : undefined;
  try {
    return NextResponse.json(await syncCalendar(id));
  } catch (err) {
    console.error('[calendar] sync failed', err);
    return NextResponse.json({ error: 'sync_failed' }, { status: 502 });
  }
}
