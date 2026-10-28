/* Sending email through Resend (server only). Each kind of email has its own
 * module and sender address (src/lib/emails/: newsletter, contact); they
 * all go out through sendEmail(). Any address on jeddahhub.org works as a
 * sender, since the domain is verified in Resend. */

const RESEND_API_KEY = process.env.RESEND_API_KEY;

/** Sender for member invitations (and anything without its own sender). */
export const MEMBERS_FROM = process.env.FROM_EMAIL || 'Jeddah Hub <members@jeddahhub.org>';

/** Whether outgoing email is set up at all (checked before side effects). */
export const emailConfigured = () => !!RESEND_API_KEY;

type SendResult = { ok: true; id?: string } | { ok: false; skipped?: true; error: string };

/** "Name <address>" with the display name quoted when needed. */
export const sender = (name: string, address: string) => `${/[",<>@]/.test(name) ? JSON.stringify(name) : name} <${address}>`;

/** Sends one email. Never throws; a missing API key reports `skipped`. */
export async function sendEmail(msg: {
  from: string;
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  headers?: Record<string, string>;
  /** Inline images (content_id) or files, base64-encoded. */
  attachments?: { filename: string; content: string; content_id?: string; content_type?: string }[];
}): Promise<SendResult> {
  if (!RESEND_API_KEY) return { ok: false, skipped: true, error: 'No RESEND_API_KEY configured' };
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: msg.from,
        to: Array.isArray(msg.to) ? msg.to : [msg.to],
        // Header injection guard: a subject is always a single line.
        subject: msg.subject.replace(/[\r\n]+/g, ' ').slice(0, 200),
        html: msg.html,
        ...(msg.text ? { text: msg.text } : {}),
        ...(msg.replyTo ? { reply_to: msg.replyTo } : {}),
        ...(msg.headers ? { headers: msg.headers } : {}),
        ...(msg.attachments?.length ? { attachments: msg.attachments } : {}),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      const error = await res.text();
      console.error('[email] Resend error', res.status, error);
      return { ok: false, error };
    }
    const data = (await res.json().catch(() => ({}))) as { id?: string };
    return { ok: true, id: data.id };
  } catch (err) {
    console.error('[email] send failed', err);
    return { ok: false, error: 'send failed' };
  }
}
