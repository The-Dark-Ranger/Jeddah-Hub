import { NextResponse } from 'next/server';
import { getRawDoc, IMAGE_SOURCES } from '@/lib/publicData';
import { isRateLimited, clientIp } from '@/lib/rateLimit';

/* Serves a photo that is stored inline (as a data: URI) on a public
 * Firestore document, e.g. /api/img/initiatives/<id>/images.2?v=<hash>.
 * src/lib/publicData.ts swaps those inline photos for these URLs, so pages
 * stay small and each photo is fetched once and cached by the CDN. The
 * document is read without credentials, so firestore.rules still decide
 * what is public; only the collections and fields in IMAGE_SOURCES are
 * served. `v` is a hash of the photo, so a changed photo gets a new URL
 * and the old one can be cached for a year. Requests that reach this code
 * missed the CDN, and each costs a database read, so one visitor gets a
 * generous but limited number per minute (a changed `v` can't be used to
 * run up reads). */

const ID_RE = /^[A-Za-z0-9_-]{1,128}$/;
const FIELD_RE = /^([A-Za-z]+)(?:\.(\d{1,3}))?$/;
const DATA_RE = /^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=]+)$/;

export async function GET(req: Request, { params }: { params: Promise<{ collection: string; id: string; field: string }> }) {
  const { collection, id, field } = await params;
  const m = FIELD_RE.exec(field);
  // Own keys only: "__proto__" or "constructor" must not reach the lookup.
  if (!ID_RE.test(id) || !m || !Object.hasOwn(IMAGE_SOURCES, collection) || !IMAGE_SOURCES[collection].includes(m[1])) {
    return new NextResponse(null, { status: 404 });
  }
  if (isRateLimited(`img:${clientIp(req)}`, 240, 60_000)) return new NextResponse(null, { status: 429 });

  const doc = await getRawDoc(collection, id).catch(() => null);
  const raw = doc?.[m[1]];
  const value = m[2] !== undefined ? (Array.isArray(raw) ? raw[Number(m[2])] : undefined) : raw;
  const match = typeof value === 'string' ? DATA_RE.exec(value) : null;
  if (!match) return new NextResponse(null, { status: 404 });

  return new NextResponse(Buffer.from(match[2], 'base64'), {
    headers: {
      'Content-Type': match[1],
      'Cache-Control': 'public, max-age=31536000, s-maxage=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
