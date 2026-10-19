import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { requireRole } from '@/lib/serverAuth';
import { isRateLimited } from '@/lib/rateLimit';

/* Drops the public pages' cached Firestore data (src/lib/publicData.ts,
 * tag 'public-data') so a dashboard change, e.g. a new or removed
 * spotlight, shows on the next visit instead of up to a minute later.
 * Curators, vice curators and impact officers only. */
export async function POST(req: NextRequest) {
  const caller = await requireRole(req, ['curator', 'vice_curator', 'impact_officer']);
  if (!caller) return NextResponse.json({ ok: false }, { status: 401 });
  if (isRateLimited(`revalidate:${caller.uid}`, 30, 60_000)) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }
  revalidateTag('public-data', { expire: 0 });
  return NextResponse.json({ ok: true });
}
