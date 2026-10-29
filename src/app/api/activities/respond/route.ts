/* POST /api/activities/respond: the only way to submit an activity's
 * registration or after-event form. Browsers can't write to
 * activity_responses directly (firestore.rules), so every response passes:
 *   rate limits → honeypot / fill-time trap → reCAPTCHA → the activity and
 *   form exist, are switched on and open → every answer is checked against
 *   that form's own questions → the same person once per form.
 * Then it is saved for the curator's Activities dashboard. */
import { createHash } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { adminApp } from '@/lib/firebaseAdmin';
import { verifyRecaptchaToken } from '@/lib/serverRecaptcha';
import { isRateLimited, clientIp } from '@/lib/rateLimit';
import { withinLimit, DAY } from '@/lib/persistentLimit';
import { isValidEmail } from '@/lib/validateEmail';
import { readJsonBody } from '@/lib/http';
import { json, isBotSubmission, isCrossSite } from '@/lib/formGuard';
import { isBlockedBot } from '@/lib/botCheck';
import type { CustomForm, CustomFormQuestion } from '@/lib/activityTypes';

const MIN_FILL_MS = 3000;
const ID_RE = /^[A-Za-z0-9]{10,40}$/;
/** Longest answer per question type (same as the form's own inputs). */
const MAX_LEN: Record<CustomFormQuestion['type'], number> = { text: 1000, textarea: 4000, select: 300, checkbox: 300, rating: 1 };

const clean = (v: unknown, max: number) =>
  typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F​-‏‪-‮⁦-⁩]/g, '').trim().slice(0, max) : '';

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  if (isCrossSite(req)) return json({ error: 'forbidden' }, 403);
  if (isRateLimited(`activity:${ip}`, 6, 10 * 60_000)) return json({ error: 'too_many' }, 429);
  if (await isBlockedBot('activity')) return json({ error: 'bot_check_failed' }, 403);

  const body = await readJsonBody(req, 64 * 1024);
  if (isBotSubmission(body, MIN_FILL_MS)) return json({ ok: true });

  const activityId = typeof body?.activityId === 'string' && ID_RE.test(body.activityId) ? body.activityId : '';
  const formType = body?.formType === 'feedback' ? 'feedback' : body?.formType === 'registration' ? 'registration' : '';
  if (!activityId || !formType) return json({ error: 'invalid' }, 400);

  if (!process.env.RECAPTCHA_SECRET_KEY) return json({ error: 'unavailable' }, 503);
  if (!(await verifyRecaptchaToken(body?.recaptchaToken, { action: 'activity_form' }))) return json({ error: 'bot_check_failed' }, 400);
  if (!(await withinLimit(`activity-ip:${ip}`, 25, DAY))) return json({ error: 'too_many' }, 429);

  const app = adminApp();
  if (!app) return json({ error: 'unavailable' }, 503);
  const db = getFirestore(app);

  // The activity, and the form being answered, must exist, be on and be open.
  const activity = await db.doc(`initiatives/${activityId}`).get().catch(() => null);
  const data = activity?.exists ? activity.data()! : null;
  if (!data || data.type !== 'hub_activity' || data.active === false || data.archived === true) return json({ error: 'closed' }, 409);
  const form = (formType === 'feedback' ? data.feedbackForm : data.customForm) as CustomForm | undefined;
  if (!form?.enabled || form.closed) return json({ error: 'closed' }, 409);

  // Every answer must belong to one of this form's questions and fit its type.
  const raw = (body?.answers && typeof body.answers === 'object' && !Array.isArray(body.answers)) ? body.answers as Record<string, unknown> : {};
  const answers: Record<string, string> = {};
  for (const q of form.questions || []) {
    const v = clean(raw[q.id], MAX_LEN[q.type] ?? 1000);
    const options = (q.options || []).map(o => o.trim()).filter(Boolean);
    if (v) {
      if (q.type === 'rating' && !/^[1-5]$/.test(v)) return json({ error: 'invalid' }, 400);
      if ((q.type === 'select' || q.type === 'checkbox') && options.length && !options.includes(v)) return json({ error: 'invalid' }, 400);
      answers[q.id] = v;
    } else if (q.required && !(q.type === 'select' && options.length === 0)) {
      return json({ error: 'missing', field: q.label }, 400);
    }
  }
  if (Object.keys(raw).some(k => !(form.questions || []).some(q => q.id === k))) return json({ error: 'invalid' }, 400);

  const name = clean(body?.name, 200);
  const email = clean(body?.email, 254).toLowerCase();
  const askName = form.collectName ?? 'optional', askEmail = form.collectEmail ?? 'optional';
  if (name && (askName === 'off' || /[<>]|https?:|www\./i.test(name))) return json({ error: 'invalid' }, 400);
  if (email && (askEmail === 'off' || !isValidEmail(email))) return json({ error: 'invalid_email' }, 400);
  if ((askName === 'required' && !name) || (askEmail === 'required' && !email)) return json({ error: 'missing' }, 400);

  // The same person answers each form once (by email when given).
  const fingerprint = email
    ? createHash('sha256').update(`${activityId}\n${formType}\n${email}`).digest('hex')
    : null;
  const response = {
    activityId, formType, answers, read: false, submittedAt: new Date().toISOString(),
    ...(name ? { submitterName: name } : {}),
    ...(email ? { submitterEmail: email, fingerprint } : {}),
  };
  try {
    if (fingerprint) {
      // Older responses have random ids, so look for those too.
      const dup = await db.collection('activity_responses').where('fingerprint', '==', fingerprint).limit(1).get();
      if (!dup.empty) return json({ ok: true, status: 'already' });
      if (!(await withinLimit(`activity-email:${email}`, 10, DAY))) return json({ error: 'too_many' }, 429);
      // The fingerprint is the document id: create() refuses a second copy
      // even when two identical submissions arrive at the same moment.
      try {
        await db.collection('activity_responses').doc(fingerprint).create(response);
      } catch (err) {
        if ((err as { code?: unknown } | null)?.code === 6) return json({ ok: true, status: 'already' }); // ALREADY_EXISTS
        throw err;
      }
    } else {
      await db.collection('activity_responses').add(response);
    }
  } catch (err) {
    console.error('[activity] save failed', err);
    return json({ error: 'save_failed' }, 500);
  }
  return json({ ok: true, status: 'saved' });
}
