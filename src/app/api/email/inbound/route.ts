/* POST /api/email/inbound: Resend's "email.received" webhook. A visitor
 * replied to their contact-form receipt (see src/lib/emails/replies.ts):
 * keep only their new text, forward it to the hub inbox as a clean email
 * with the original message, and save it on that message in the dashboard.
 * Only signed requests from Resend are accepted, and it only ever emails
 * the hub's own inbox. */
import { NextRequest, NextResponse } from 'next/server';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { adminApp } from '@/lib/firebaseAdmin';
import { verifyWebhook } from '@/lib/webhookSignature';
import { sendEmail } from '@/lib/email';
import { CONTACT_INBOX } from '@/lib/emails/contact';
import {
  repliesEnabled, WEBHOOK_SECRET, INBOUND_KEY, messageIdFrom, newTextOnly, htmlToText, replyRelay,
} from '@/lib/emails/replies';
import { isValidEmail } from '@/lib/validateEmail';

const MAX_BODY = 256 * 1024;

/** "Sara Ahmed <sara@x.com>" → { name, email } */
function parseFrom(from: string): { name?: string; email: string } {
  const m = /^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/.exec(from);
  return m ? { name: m[1].trim() || undefined, email: m[2].trim() } : { email: from.trim() };
}

export async function POST(req: NextRequest) {
  if (!repliesEnabled()) return NextResponse.json({ error: 'Not configured' }, { status: 503 });

  const raw = await req.text();
  if (raw.length > MAX_BODY || !verifyWebhook(raw, req.headers, WEBHOOK_SECRET!)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let event: { type?: string; data?: { email_id?: string; from?: string; to?: string[]; subject?: string } };
  try { event = JSON.parse(raw); } catch { return NextResponse.json({ error: 'Bad JSON' }, { status: 400 }); }
  // Other event types are acknowledged and ignored.
  if (event.type !== 'email.received' || !event.data?.email_id) return NextResponse.json({ ok: true, ignored: true });

  const messageId = messageIdFrom(event.data.to ?? []);
  if (!messageId) return NextResponse.json({ ok: true, ignored: 'not a receipt reply' });

  // The webhook carries no body; fetch the received email.
  const res = await fetch(`https://api.resend.com/emails/receiving/${encodeURIComponent(event.data.email_id)}`, {
    headers: { Authorization: `Bearer ${INBOUND_KEY}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    console.error('[inbound] could not fetch email', res.status, await res.text());
    return NextResponse.json({ error: 'Fetch failed' }, { status: 502 }); // Resend retries
  }
  const mail = (await res.json()) as { from?: string; subject?: string; text?: string | null; html?: string | null };

  const from = parseFrom(mail.from || event.data.from || '');
  if (!isValidEmail(from.email)) return NextResponse.json({ ok: true, ignored: 'bad sender' });
  const replyText = newTextOnly(mail.text || htmlToText(mail.html || '')).slice(0, 5000);

  // The original message, for context; the reply is saved on it too.
  let original: { name: string; email: string; message: string; submittedAt?: string; ref: string } | undefined;
  const app = adminApp();
  if (app) {
    try {
      const ref = getFirestore(app).doc(`contact_messages/${messageId}`);
      const snap = await ref.get();
      if (snap.exists) {
        const d = snap.data()!;
        original = { name: String(d.name ?? ''), email: String(d.email ?? ''), message: String(d.message ?? ''), submittedAt: d.submittedAt, ref: messageId };
        // Resend retries a failed delivery; the event id keeps it saved once.
        const eventId = req.headers.get('svix-id') ?? event.data.email_id;
        const saved = Array.isArray(d.replies) && d.replies.some((r: { id?: string }) => r?.id === eventId);
        if (!saved) {
          await ref.update({
            replies: FieldValue.arrayUnion({ id: eventId, from: from.email, text: replyText, at: new Date().toISOString() }),
            read: false, // shows as new in the dashboard
          });
        }
      }
    } catch (err) {
      console.error('[inbound] Firestore', err);
    }
  }

  const relay = replyRelay({ fromEmail: from.email, fromName: from.name, replyText, subject: mail.subject, original, at: new Date() });
  const sent = await sendEmail({ ...relay, to: CONTACT_INBOX, replyTo: from.email });
  if (!sent.ok) return NextResponse.json({ error: 'Relay failed' }, { status: 502 }); // Resend retries
  return NextResponse.json({ ok: true });
}
