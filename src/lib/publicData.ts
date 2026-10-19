import { createHash } from 'node:crypto';
import { unstable_cache } from 'next/cache';

/* Public site data, read on the server and sent inside the page HTML.
 *
 * Public pages used to fetch Firestore from the browser after the page had
 * loaded, so content appeared seconds late on phones and slow networks, or
 * not at all where Firestore's streaming connection is blocked. Here the
 * same public collections are read once on the server through Firestore's
 * REST API, without credentials, so firestore.rules still decide what is
 * visible, and cached for REVALIDATE seconds.
 *
 * Photos stored inline as data: URIs (up to ~300 KB per initiative) are
 * swapped for /api/img URLs, so the page carries a few bytes per photo and
 * each photo downloads once, in parallel, cached by the CDN.
 *
 * Server-only: imports node:crypto, so it can't be bundled for the browser. */

const PROJECT = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
/** How long public data is cached before the next visit refreshes it. */
const REVALIDATE = 60;

export type Doc = Record<string, unknown> & { id: string };

type Value = {
  nullValue?: null; booleanValue?: boolean; integerValue?: string; doubleValue?: number;
  timestampValue?: string; stringValue?: string; bytesValue?: string; referenceValue?: string;
  geoPointValue?: { latitude: number; longitude: number };
  arrayValue?: { values?: Value[] }; mapValue?: { fields?: Record<string, Value> };
};

/** Firestore REST value to plain JSON. Timestamps become ISO strings. */
function fromValue(v: Value): unknown {
  if ('stringValue' in v) return v.stringValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('nullValue' in v) return null;
  if ('arrayValue' in v) return (v.arrayValue?.values ?? []).map(fromValue);
  if ('mapValue' in v) return fromFields(v.mapValue?.fields);
  if ('geoPointValue' in v) return v.geoPointValue;
  if ('referenceValue' in v) return v.referenceValue;
  return null;
}

function fromFields(fields: Record<string, Value> | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields ?? {})) out[k] = fromValue(v);
  return out;
}

const DATA_URI = /^data:image\/(?:jpeg|png|webp|gif);base64,/;

/** Short content hash, so a changed photo gets a new (uncached) URL. */
function hashOf(s: string) {
  return createHash('sha1').update(s).digest('base64url').slice(0, 12);
}

/** Collections and top-level fields whose inline photos /api/img serves. */
export const IMAGE_SOURCES: Record<string, string[]> = {
  initiatives: ['imageUrl', 'images'],
  public_profiles: ['photoURL'],
};

/** Replaces inline photos (strings or string arrays) with /api/img URLs
 *  that serve the same bytes. */
function externalizeImages(collection: string, d: Doc): Doc {
  const out: Doc = { ...d };
  const url = (path: string, data: string) =>
    `/api/img/${collection}/${encodeURIComponent(d.id)}/${path}?v=${hashOf(data)}`;
  for (const f of IMAGE_SOURCES[collection] ?? []) {
    const v = out[f];
    if (typeof v === 'string' && DATA_URI.test(v)) out[f] = url(f, v);
    else if (Array.isArray(v)) out[f] = v.map((x, i) => (typeof x === 'string' && DATA_URI.test(x) ? url(`${f}.${i}`, x) : x));
  }
  return out;
}

type RestDoc = { name: string; fields?: Record<string, Value> };
const toDoc = (d: RestDoc): Doc => ({ id: d.name.split('/').pop()!, ...fromFields(d.fields) });

async function listCollection(collection: string): Promise<Doc[]> {
  const docs: Doc[] = [];
  let pageToken = '';
  do {
    const res = await fetch(`${BASE}/${collection}?pageSize=300${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`, {
      cache: 'no-store', signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`list ${collection}: ${res.status}`);
    const body = await res.json() as { documents?: RestDoc[]; nextPageToken?: string };
    docs.push(...(body.documents ?? []).map(toDoc));
    pageToken = body.nextPageToken ?? '';
  } while (pageToken);
  return docs;
}

/** For collections whose rules only allow a filtered read (published blogs). */
async function queryEquals(collection: string, field: string, value: string): Promise<Doc[]> {
  const res = await fetch(`${BASE}:runQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: collection }],
        where: { fieldFilter: { field: { fieldPath: field }, op: 'EQUAL', value: { stringValue: value } } },
      },
    }),
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`query ${collection}: ${res.status}`);
  const rows = await res.json() as { document?: RestDoc }[];
  return rows.flatMap(r => (r.document ? [toDoc(r.document)] : []));
}

/** One raw document, for /api/img. Cached briefly; null if missing or not public. */
export async function getRawDoc(collection: string, id: string): Promise<Doc | null> {
  const res = await fetch(`${BASE}/${collection}/${encodeURIComponent(id)}`, {
    next: { revalidate: REVALIDATE }, signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return null;
  return toDoc(await res.json() as RestDoc);
}

const cached = <T>(key: string, fn: () => Promise<T>) =>
  unstable_cache(fn, ['public-data', key], { revalidate: REVALIDATE, tags: ['public-data'] });

const loadInitiatives = cached('initiatives', async () =>
  (await listCollection('initiatives')).map(d => externalizeImages('initiatives', d)));

const loadProfiles = cached('public_profiles', async () =>
  (await listCollection('public_profiles')).map(d => externalizeImages('public_profiles', d)));

const loadBlogs = cached('blogs', () => queryEquals('blogs', 'status', 'published'));

/** Never throws: a failed read returns null and the page falls back to
 *  loading the data in the browser, as it did before. */
async function safe<T>(fn: () => Promise<T>): Promise<T | null> {
  if (!PROJECT) return null;
  try {
    return await fn();
  } catch (err) {
    console.error('publicData:', (err as Error).message);
    return null;
  }
}

const normRole = (r: unknown) => (typeof r === 'string' ? r.toLowerCase().replace(/\s+/g, '_') : '');

/** The "Our Shapers" number on Who We Are: shapers plus the curatorship
 *  (curator, vice curator, impact officer) who are listed there, i.e. who
 *  have a name. Alumni aren't counted. Used wherever that number appears. */
export function countListedShapers(profiles: Doc[]): number {
  return profiles.filter(p =>
    p.displayName && ['shaper', 'curator', 'vice_curator', 'impact_officer'].includes(normRole(p.role))).length;
}

/** Every initiative doc: real initiatives and Hub Activities (type 'hub_activity'). */
export const getInitiatives = () => safe(loadInitiatives);
export const getPublicProfiles = () => safe(loadProfiles);
export const getPublishedBlogs = () => safe(loadBlogs);
