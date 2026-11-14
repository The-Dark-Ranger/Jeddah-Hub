/* Server only. How the photo routes (/api/media/<id>, /api/img/…) answer:
 * the stored photo as a real image, cached by the CDN for a year (a changed
 * photo always gets a new address). A `w` of one of PHOTO_WIDTHS asks for a
 * smaller copy, for avatars, thumbnails and cards: a 44px avatar shouldn't
 * download a 1280px photo on a phone. Each size is made once per CDN
 * region and then served from the cache. */
import { NextResponse } from 'next/server';

/** The widths a page may ask for (the CDN keeps one copy of each). */
export const PHOTO_WIDTHS = [96, 192, 384, 768] as const;
export type PhotoWidth = (typeof PHOTO_WIDTHS)[number];

/** The `w` this request asks for, if it's one of PHOTO_WIDTHS. */
export function requestedWidth(req: Request): PhotoWidth | null {
  const w = Number(new URL(req.url).searchParams.get('w'));
  return (PHOTO_WIDTHS as readonly number[]).includes(w) ? (w as PhotoWidth) : null;
}

export async function photoResponse(bytes: Buffer, type: string, width: PhotoWidth | null): Promise<NextResponse> {
  let body: Buffer = bytes;
  let contentType = type;
  // GIFs may be animated: always served as they are.
  if (width && type !== 'image/gif') {
    try {
      const sharp = (await import('sharp')).default;
      body = await sharp(bytes).rotate().resize({ width, withoutEnlargement: true }).webp({ quality: 76 }).toBuffer();
      contentType = 'image/webp';
    } catch (err) {
      // No image library on this server, or a photo it can't read: the
      // full photo still works.
      console.error('[photo] could not make a smaller copy', err);
    }
  }
  return new NextResponse(new Uint8Array(body), {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000, s-maxage=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
