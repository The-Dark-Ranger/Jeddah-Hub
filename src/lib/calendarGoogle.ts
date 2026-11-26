/* Server only. The hub's Google Calendar: the calendar's events are copied
 * into the hub Gmail account's calendar, with hub members as guests, so
 * Google emails the invites and members reply from their own calendar app.
 * Their replies are read back into each event's `replies`.
 *
 * The link: a curator signs in to the hub's Google account once
 * (Dashboard > Calendar > Link Google Calendar) and allows "see and edit
 * events" only (the calendar.events scope: no email, contacts or files).
 * Google then gives a long-lived key (refresh token), kept in
 * server_secrets/google_calendar, which firestore.rules opens to nobody;
 * only this server reads it, through the Admin SDK. Unlinking: remove the
 * site's access at myaccount.google.com/permissions on the hub account.
 *
 * Needs GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET (see
 * docs/GOOGLE_CALENDAR.md). Every Google request is a plain fetch: no
 * Google library to keep up to date. */
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { decodeJwt } from 'jose';
import { FieldValue, getFirestore, type DocumentSnapshot, type Firestore } from 'firebase-admin/firestore';
import { adminApp } from './firebaseAdmin';
import { USE_EMULATORS } from './emulators';
import { SITE_URL } from './seo';

const CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID ?? '';
const CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? '';
/** The only Google account that may be linked: the hub's. */
export const HUB_ACCOUNT = (process.env.GOOGLE_CALENDAR_ACCOUNT || 'jeddahglobalshapers@gmail.com').toLowerCase();
export const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events';

// Local test runs point these at a stand-in for Google; never in production.
const OAUTH_BASE = (USE_EMULATORS && process.env.GOOGLE_OAUTH_BASE) || 'https://oauth2.googleapis.com';
const AUTH_PAGE = (USE_EMULATORS && process.env.GOOGLE_AUTH_PAGE) || 'https://accounts.google.com/o/oauth2/v2/auth';
const API = `${(USE_EMULATORS && process.env.GOOGLE_API_BASE) || 'https://www.googleapis.com'}/calendar/v3/calendars/primary/events`;

const TZ = 'Asia/Riyadh';
const SECRET_DOC = 'server_secrets/google_calendar';
const STATUS_DOC = 'calendar_settings/google';

export const googleConfigured = () => !!CLIENT_ID && !!CLIENT_SECRET;
const db = (): Firestore | null => { const app = adminApp(); return app ? getFirestore(app) : null; };

/* ── Linking the hub account ─────────────────────────────────────────── */

/** `state` carries who asked and the page language through Google's sign-in,
 *  signed so it can't be forged, and expires after 10 minutes. */
function sign(text: string) {
  return createHmac('sha256', CLIENT_SECRET).update(text).digest('base64url');
}
function makeState(uid: string, locale: string) {
  const body = Buffer.from(JSON.stringify({ uid, locale, exp: Date.now() + 10 * 60_000, n: randomBytes(8).toString('hex') })).toString('base64url');
  return `${body}.${sign(body)}`;
}
export function readState(state: string): { uid: string; locale: string } | null {
  const [body, sig] = state.split('.');
  if (!body || !sig) return null;
  const want = Buffer.from(sign(body));
  const got = Buffer.from(sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  try {
    const s = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (typeof s.uid !== 'string' || typeof s.exp !== 'number' || s.exp < Date.now()) return null;
    return { uid: s.uid, locale: s.locale === 'ar' ? 'ar' : 'en' };
  } catch {
    return null;
  }
}

/** Google's sign-in page, asking the hub account for calendar access. */
export function consentUrl(uid: string, locale: string, redirectUri: string) {
  const q = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: `openid email ${CALENDAR_SCOPE}`,
    access_type: 'offline', // a key that keeps working after today
    prompt: 'consent', // always issue that key, even when linked before
    login_hint: HUB_ACCOUNT,
    state: makeState(uid, locale),
  });
  return `${AUTH_PAGE}?${q}`;
}

/** Finishes linking: trades Google's one-time code for the key and saves it.
 *  Refuses any account but the hub's, and a sign-in without calendar access. */
export async function finishLink(code: string, redirectUri: string, uid: string): Promise<'linked' | 'wrong_account' | 'no_access' | 'failed'> {
  const store = db();
  if (!store) return 'failed';
  const res = await fetch(`${OAUTH_BASE}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, client_id: CLIENT_ID, client_secret: CLIENT_SECRET, redirect_uri: redirectUri, grant_type: 'authorization_code' }),
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);
  if (!res?.ok) return 'failed';
  const t = await res.json().catch(() => null);
  // The ID token comes straight from Google over HTTPS, so its email can be read as is.
  let email = '';
  try { email = String(decodeJwt(String(t?.id_token)).email ?? '').toLowerCase(); } catch { /* no email */ }
  if (email !== HUB_ACCOUNT) return 'wrong_account';
  if (!String(t?.scope ?? '').split(' ').includes(CALENDAR_SCOPE) || typeof t?.refresh_token !== 'string') return 'no_access';
  await store.doc(SECRET_DOC).set({ refreshToken: t.refresh_token, email, linkedBy: uid, linkedAt: FieldValue.serverTimestamp() });
  await store.doc(STATUS_DOC).set({ connected: true, email, linkedAt: FieldValue.serverTimestamp(), error: null });
  cached = null;
  return 'linked';
}

/* ── Talking to Google Calendar ──────────────────────────────────────── */

let cached: { token: string; until: number } | null = null;

class Unlinked extends Error {}

/** A short-lived access token from the saved key, reused until it's about to expire. */
async function accessToken(store: Firestore): Promise<string | null> {
  if (cached && cached.until > Date.now() + 60_000) return cached.token;
  const saved = await store.doc(SECRET_DOC).get();
  const refreshToken = saved.get('refreshToken');
  if (typeof refreshToken !== 'string') return null;
  const res = await fetch(`${OAUTH_BASE}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ refresh_token: refreshToken, client_id: CLIENT_ID, client_secret: CLIENT_SECRET, grant_type: 'refresh_token' }),
    signal: AbortSignal.timeout(10_000),
  });
  const t = await res.json().catch(() => null);
  if (!res.ok) {
    // invalid_grant: access was removed in the Google account, or the
    // password changed. Say so on the calendar, so a curator links it again.
    if (t?.error === 'invalid_grant') {
      await store.doc(STATUS_DOC).set({ connected: false, error: 'relink' }, { merge: true });
      await store.doc(SECRET_DOC).delete();
      throw new Unlinked();
    }
    throw new Error(`token ${res.status}`);
  }
  cached = { token: t.access_token, until: Date.now() + Number(t.expires_in ?? 3000) * 1000 };
  return cached.token;
}

async function google(token: string, method: string, path: string, body?: unknown) {
  return fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(10_000),
  });
}

/** Google event ids allow only 0-9 and a-v, so the Firestore id is written in hex.
 *  The same event always gets the same id, so a retry can never make a copy. */
const googleId = (id: string) => `jh${Buffer.from(id).toString('hex')}`;

const addDay = (d: string, n = 1) => {
  const x = new Date(`${d}T12:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};
/** "2026-11-26" + "23:30" + 60 minutes = "2026-11-27T00:30:00". */
function plusMinutes(date: string, time: string, minutes: number) {
  const x = new Date(`${date}T${time}:00Z`);
  x.setUTCMinutes(x.getUTCMinutes() + minutes);
  return x.toISOString().slice(0, 19);
}

type EventData = Record<string, unknown> & {
  title: string; kind: string; startDate: string; endDate: string; startTime?: string; endTime?: string;
  weekly?: boolean; repeatUntil?: string | null; skipDates?: string[]; location?: string; notes?: string;
};

/** The calendar event as Google wants it, with the guests' email addresses. */
export function googleEvent(id: string, d: EventData, emails: string[]) {
  const allDay = !d.startTime || d.kind === 'deadline' || d.endDate !== d.startDate;
  const start = allDay ? { date: d.startDate } : { dateTime: `${d.startDate}T${d.startTime}:00`, timeZone: TZ };
  const end = allDay
    ? { date: addDay(d.endDate) } // Google's all-day end is the day after
    : { dateTime: d.endTime ? `${d.startDate}T${d.endTime}:00` : plusMinutes(d.startDate, d.startTime!, 60), timeZone: TZ };
  const recurrence: string[] = [];
  if (d.weekly && d.endDate === d.startDate) {
    recurrence.push(`RRULE:FREQ=WEEKLY${d.repeatUntil ? `;UNTIL=${d.repeatUntil.replaceAll('-', '')}` : ''}`);
    const skips = (d.skipDates ?? []).filter(s => /^\d{4}-\d{2}-\d{2}$/.test(s)).map(s => s.replaceAll('-', ''));
    if (skips.length) {
      recurrence.push(allDay
        ? `EXDATE;VALUE=DATE:${skips.join(',')}`
        : `EXDATE;TZID=${TZ}:${skips.map(s => `${s}T${d.startTime!.replace(':', '')}00`).join(',')}`);
    }
  }
  return {
    id: googleId(id),
    summary: d.kind === 'deadline' ? `Due: ${d.title}` : d.title,
    location: d.location || undefined,
    description: [d.notes, `Jeddah Hub calendar: ${SITE_URL}/en/dashboard/shaper/calendar`].filter(Boolean).join('\n\n'),
    start, end,
    recurrence: recurrence.length ? recurrence : undefined,
    attendees: emails.map(email => ({ email })),
    guestsCanInviteOthers: false,
    extendedProperties: { private: { jeddahHubId: id } },
  };
}

const hashOf = (x: unknown) => createHash('sha256').update(JSON.stringify(x)).digest('base64url').slice(0, 22);

/** Members' email addresses by uid: those given, or everyone (one read of
 *  the members list per sweep instead of one per guest per event). */
async function emailBook(store: Firestore, uids?: string[]): Promise<Map<string, string>> {
  const docs = uids
    ? (uids.length ? await store.getAll(...uids.map(u => store.doc(`users/${u}`))) : [])
    : (await store.collection('users').select('email').get()).docs;
  const book = new Map<string, string>();
  for (const u of docs) {
    const email = String(u.get('email') ?? '').trim().toLowerCase();
    if (email.includes('@') && email !== HUB_ACCOUNT) book.set(u.id, email);
  }
  return book;
}

const peopleOf = (d: EventData) =>
  [...new Set(((d.people ?? []) as { userId?: unknown }[]).map(p => p.userId).filter((u): u is string => typeof u === 'string' && !!u))];

/** The event's guests' email addresses. */
const guestEmails = (d: EventData, book: Map<string, string>) =>
  peopleOf(d).map(u => book.get(u)).filter((e): e is string => !!e);

/** What would be sent to Google for this event, and its fingerprint. */
function planned(snap: DocumentSnapshot, book: Map<string, string>) {
  const body = googleEvent(snap.id, snap.data() as EventData, guestEmails(snap.data() as EventData, book));
  return { body, hash: hashOf(body) };
}

/** Brings one event's Google copy in line with the database: creates,
 *  updates or cancels it (Google emails the guests each time), and removes
 *  an event marked deleted. Does nothing when nothing changed. */
async function syncEvent(token: string | null, snap: DocumentSnapshot, book: Map<string, string>) {
  const d = snap.data() as EventData | undefined;
  if (!d) return;
  const synced = d.google as { hash?: string } | undefined;
  if (d.deleted === true) {
    if (synced?.hash && token) {
      const res = await google(token, 'DELETE', `/${googleId(snap.id)}?sendUpdates=all`);
      if (!res.ok && res.status !== 404 && res.status !== 410) throw new Error(`delete ${res.status}`);
    } else if (synced?.hash) {
      return; // Unlinked for now: keep it, so its invite is cancelled once linked again.
    }
    await snap.ref.delete();
    return;
  }
  if (!token) return;
  const { body, hash } = planned(snap, book);
  if (synced?.hash === hash) return;
  let res = synced?.hash
    ? await google(token, 'PUT', `/${body.id}?sendUpdates=all`, body)
    : await google(token, 'POST', `?sendUpdates=all`, body);
  // Already there (a retry), or gone from Google (deleted by hand): try the other way.
  if (res.status === 409) res = await google(token, 'PUT', `/${body.id}?sendUpdates=all`, body);
  else if (res.status === 404 || res.status === 410) res = await google(token, 'POST', `?sendUpdates=all`, body);
  if (res.status === 429 || res.status >= 500) throw new Error(`google ${res.status}`); // try again next time
  const failed = !res.ok;
  if (failed) console.error('[calendar] Google refused event', snap.id, res.status, (await res.text().catch(() => '')).slice(0, 300));
  // Only if nobody edited it meanwhile; otherwise their own sync follows.
  await snap.ref.update({ google: { hash, syncedAt: FieldValue.serverTimestamp(), failed } }, { lastUpdateTime: snap.updateTime! })
    .catch(() => {});
}

const REPLY: Record<string, string> = { accepted: 'yes', declined: 'no', tentative: 'maybe' };

/** Reads every upcoming event's guest replies from Google into `replies`. */
async function pullReplies(token: string, docs: DocumentSnapshot[], book: Map<string, string>) {
  const byId = new Map(docs.filter(s => (s.get('google') as { hash?: string } | undefined)?.hash).map(s => [s.id, s]));
  if (!byId.size) return;
  const timeMin = new Date(Date.now() - 2 * 86_400_000).toISOString();
  let page = '';
  for (let i = 0; i < 5; i++) {
    const res = await google(token, 'GET', `?maxResults=250&timeMin=${encodeURIComponent(timeMin)}${page ? `&pageToken=${encodeURIComponent(page)}` : ''}`);
    if (!res.ok) return;
    const list = await res.json();
    for (const item of list.items ?? []) {
      const snap = byId.get(item.extendedProperties?.private?.jeddahHubId);
      if (!snap) continue;
      const uidOf = new Map(peopleOf(snap.data() as EventData).filter(u => book.has(u)).map(u => [book.get(u)!, u]));
      const replies: Record<string, string> = {};
      for (const a of item.attendees ?? []) {
        const uid = uidOf.get(String(a.email ?? '').toLowerCase());
        if (uid && REPLY[a.responseStatus]) replies[uid] = REPLY[a.responseStatus];
      }
      if (JSON.stringify(replies) !== JSON.stringify(snap.get('replies') ?? {})) {
        await snap.ref.update({ replies }).catch(() => {});
      }
    }
    page = list.nextPageToken ?? '';
    if (!page) return;
  }
}

/** How often the calendar checks everything with Google, however many people open it. */
const SWEEP_EVERY_MS = 10 * 60_000;

/**
 * Brings the hub's Google Calendar in line with the database. With an `id`
 * (just saved or deleted), that event straight away. Then, at most every few
 * minutes, everything: upcoming events not yet in Google (saved while it was
 * unlinked, or when Google was down), events marked deleted, and the replies.
 */
export async function syncCalendar(id?: string): Promise<{ linked: boolean }> {
  const store = db();
  if (!store) return { linked: false };
  let token: string | null = null;
  try {
    token = googleConfigured() ? await accessToken(store) : null;
  } catch (e) {
    if (!(e instanceof Unlinked)) throw e;
  }
  const events = store.collection('calendar_events');
  if (id) {
    const snap = await events.doc(id).get();
    if (snap.exists) await syncEvent(token, snap, await emailBook(store, peopleOf(snap.data() as EventData)));
  }

  // One sweep per few minutes across all servers: claim it in the database.
  const claimed = await store.runTransaction(async tx => {
    const ref = store.doc('server_secrets/google_calendar_sweep');
    const last = Number((await tx.get(ref)).get('at') ?? 0);
    if (Date.now() - last < SWEEP_EVERY_MS) return false;
    tx.set(ref, { at: Date.now() });
    return true;
  }).catch(() => false);
  if (!claimed) return { linked: !!token };

  const today = new Date(Date.now() + 3 * 3_600_000).toISOString().slice(0, 10); // Jeddah's date
  const [upcoming, removed] = await Promise.all([
    events.where('endDate', '>=', addDay(today, -1)).get(),
    events.where('deleted', '==', true).limit(25).get(),
  ]);
  // A weekly series keeps going after its first date, so include those too.
  const weekly = (await events.where('weekly', '==', true).get()).docs.filter(s => !upcoming.docs.some(u => u.id === s.id));
  const all = [...upcoming.docs, ...weekly].filter(s => !s.get('deleted'));
  const book = await emailBook(store);
  let done = 0;
  for (const snap of [...removed.docs, ...all]) {
    if (done >= 25) break; // keep one request short; the next sweep carries on
    // Unchanged events are skipped by comparing fingerprints, without asking Google.
    if (!snap.get('deleted') && (!token || (snap.get('google') as { hash?: string } | undefined)?.hash === planned(snap, book).hash)) continue;
    await syncEvent(token, snap, book).catch(err => console.error('[calendar] sync failed', snap.id, err));
    done++;
  }
  if (token) await pullReplies(token, all, book).catch(err => console.error('[calendar] replies failed', err));
  return { linked: !!token };
}
