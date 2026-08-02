/* Client-side image compression → data URI.
 *
 * Photos are compressed in the browser and stored as data URIs directly on the
 * initiative document. Every consumer already renders them with a plain
 * <img src> or a CSS url(), so no reader needs to change and no extra Firebase
 * product (Storage) has to be enabled or given its own rules deployment.
 *
 * The tradeoff is Firestore's hard 1 MiB per-document limit, so callers must
 * respect DOC_BUDGET_BYTES — fitsInBudget() below does that check. */

/** Ceiling for all photo data on one initiative. Firestore allows 1 MiB per
 *  document; the remainder is headroom for the title/description/etc. */
export const DOC_BUDGET_BYTES = 880_000;

/** Ceiling for a single photo after compression. */
export const MAX_IMAGE_BYTES = 260_000;

const MAX_DIMENSION = 1280;
const START_QUALITY = 0.72;
const MIN_QUALITY   = 0.4;

/** Data URIs are ASCII, so string length is the byte count. */
export function byteSize(dataUrl: string): number {
  return dataUrl.length;
}

export function totalBytes(coverUrl: string, photos: string[]): number {
  return byteSize(coverUrl) + photos.reduce((sum, p) => sum + byteSize(p), 0);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Remote URLs cost almost nothing; only inline data URIs count against the budget. */
export function isDataUri(value: string): boolean {
  return value.startsWith('data:');
}

async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      // 'from-image' applies EXIF orientation so phone photos are not sideways.
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      /* Safari/older browsers: fall through to the <img> path. */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function draw(src: ImageBitmap | HTMLImageElement, maxDim: number): HTMLCanvasElement {
  const sw = (src as HTMLImageElement).naturalWidth  || src.width;
  const sh = (src as HTMLImageElement).naturalHeight || src.height;

  const scale = Math.min(1, maxDim / Math.max(sw, sh));
  const w = Math.max(1, Math.round(sw * scale));
  const h = Math.max(1, Math.round(sh * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas-unsupported');

  // JPEG has no alpha channel — flatten transparency onto white instead of black.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(src as CanvasImageSource, 0, 0, w, h);

  return canvas;
}

/**
 * Compress an image file to a JPEG data URI under MAX_IMAGE_BYTES.
 * Steps quality down first, then dimensions, so the result stays predictable.
 *
 * Throws 'not-an-image' for non-image files and 'decode-failed' for formats the
 * browser cannot decode (notably HEIC outside Safari).
 */
export async function compressToDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('not-an-image');

  let src: ImageBitmap | HTMLImageElement;
  try {
    src = await decode(file);
  } catch {
    throw new Error('decode-failed');
  }

  try {
    for (let maxDim = MAX_DIMENSION; maxDim >= 640; maxDim = Math.round(maxDim * 0.75)) {
      const canvas = draw(src, maxDim);
      for (let q = START_QUALITY; q >= MIN_QUALITY; q -= 0.1) {
        const out = canvas.toDataURL('image/jpeg', q);
        if (byteSize(out) <= MAX_IMAGE_BYTES) return out;
      }
    }
    // Smallest configuration we allow, even if marginally over the ceiling.
    return draw(src, 640).toDataURL('image/jpeg', MIN_QUALITY);
  } finally {
    if ('close' in src) src.close();
  }
}
