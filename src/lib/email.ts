/* Sending email through Resend (server only). Every outgoing email goes
 * through sendEmail(), from FROM_EMAIL on the domain verified in Resend. */

const RESEND_API_KEY = process.env.RESEND_API_KEY;
export const FROM_EMAIL = process.env.FROM_EMAIL || 'Jeddah Hub <newsletter@jeddahhub.org>';
/** Where contact-form messages are delivered. */
export const CONTACT_INBOX = process.env.CONTACT_INBOX || 'jeddahglobalshapers@gmail.com';

/** Whether outgoing email is set up at all (checked before side effects). */
export const emailConfigured = () => !!RESEND_API_KEY;

export type SendResult = { ok: true; id?: string } | { ok: false; skipped?: true; error: string };

/** Sends one email. Never throws; a missing API key reports `skipped`. */
export async function sendEmail(msg: {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}): Promise<SendResult> {
  if (!RESEND_API_KEY) return { ok: false, skipped: true, error: 'No RESEND_API_KEY configured' };
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: Array.isArray(msg.to) ? msg.to : [msg.to],
        // Header injection guard: a subject is always a single line.
        subject: msg.subject.replace(/[\r\n]+/g, ' ').slice(0, 200),
        html: msg.html,
        ...(msg.text ? { text: msg.text } : {}),
        ...(msg.replyTo ? { reply_to: msg.replyTo } : {}),
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

/** The branded frame every email shares (blue header, white card, footer). */
export function emailLayout({ lang, title, body, footer }: {
  lang: 'en' | 'ar'; title: string; body: string; footer: string;
}): string {
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const align = lang === 'ar' ? 'right' : 'left';
  return `<!DOCTYPE html>
<html lang="${lang}" dir="${dir}">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Tahoma,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" dir="${dir}" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);text-align:${align};">
        <tr>
          <td style="background:#0f5a9f;background:linear-gradient(135deg,#0f5a9f 0%,#1a73e8 100%);padding:36px 40px 28px;">
            <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:rgba(255,255,255,0.75);letter-spacing:0.1em;text-transform:uppercase;">Global Shapers Community</p>
            <h1 style="margin:0;font-size:30px;font-weight:800;color:#ffffff;">${lang === 'ar' ? 'مجتمع جدة' : 'Jeddah Hub'}</h1>
          </td>
        </tr>
        <tr><td style="padding:36px 40px;">${body}</td></tr>
        <tr>
          <td style="background:#f8fafc;padding:22px 40px;border-top:1px solid #e2e8f0;">
            <p style="margin:0 0 6px;font-size:13px;color:#94a3b8;line-height:1.6;">${footer}</p>
            <p style="margin:0;font-size:12px;color:#cbd5e1;">© ${new Date().getFullYear()} Global Shapers Community, Jeddah Hub</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
