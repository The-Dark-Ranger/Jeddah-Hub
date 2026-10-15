import { NextResponse } from 'next/server';

/* Serves a photo stored in the Firestore `media` collection (one document per
 * photo, see src/lib/media.ts) as a real image, so pages keep using a plain
 * <img src="/api/media/<id>">. Media documents are immutable — a new upload
 * always gets a new id — so responses are cached for a year at the CDN. */

const PROJECT = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const ID_RE = /^[A-Za-z0-9]{20}$/;
const DATA_RE = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!PROJECT || !ID_RE.test(id)) return new NextResponse(null, { status: 404 });

  let res: Response;
  try {
    res = await fetch(
      `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(PROJECT)}/databases/(default)/documents/media/${id}`,
      { signal: AbortSignal.timeout(8000), cache: 'no-store' },
    );
  } catch {
    return new NextResponse(null, { status: 504 });
  }
  if (!res.ok) return new NextResponse(null, { status: res.status === 404 ? 404 : 502 });

  const doc = await res.json().catch(() => null) as { fields?: { data?: { stringValue?: string } } } | null;
  const match = doc?.fields?.data?.stringValue?.match(DATA_RE);
  if (!match) return new NextResponse(null, { status: 404 });

  return new NextResponse(Buffer.from(match[2], 'base64'), {
    headers: {
      'Content-Type': match[1],
      'Cache-Control': 'public, max-age=31536000, s-maxage=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
