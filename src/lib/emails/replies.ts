/* Replies to the contact-form receipt.
 *
 * The receipt's reply-to is a per-message address on Resend's receiving
 * domain (jh-<id>@<RESEND_REPLY_DOMAIN>). When the visitor replies, Resend
 * calls /api/email/inbound; that route keeps only the new text (dropping the
 * quoted receipt below it) and forwards it to the hub inbox as a clean email
 * next to the original message, and saves it on the message in the dashboard.
 *
 * Until receiving is configured (the three env vars below), the receipt's
 * reply-to stays the hub inbox, as before. */
import { escapeHtml } from '@/lib/escapeHtml';
import { sender } from '@/lib/email';
import { emailLayout, heading, paragraph, sectionTitle, infoTable, quote, button, jeddahTime, SITE } from './layout';

const REPLY_DOMAIN = process.env.RESEND_REPLY_DOMAIN?.trim().toLowerCase();
export const INBOUND_KEY = process.env.RESEND_INBOUND_KEY?.trim();
export const WEBHOOK_SECRET = process.env.RESEND_WEBHOOK_SECRET?.trim();
export const repliesEnabled = () => !!(REPLY_DOMAIN && INBOUND_KEY && WEBHOOK_SECRET);

/* Firestore ids are mixed-case, but email addresses may be lower-cased on
 * the way, so the id travels hex-encoded. */
const toHex = (s: string) => Buffer.from(s, 'utf8').toString('hex');
const fromHex = (h: string) => Buffer.from(h, 'hex').toString('utf8');

/** The address replies to this message's receipt should go to, if enabled. */
export function replyAddress(messageId?: string): string | null {
  if (!repliesEnabled() || !messageId) return null;
  return `jh-${toHex(messageId)}@${REPLY_DOMAIN}`;
}

/** The message id from a reply's recipient list, or null. */
export function messageIdFrom(recipients: string[]): string | null {
  for (const r of recipients) {
    const m = /^(?:.*<)?jh-([0-9a-f]{20,80})@([^>\s]+)>?$/i.exec(r.trim());
    if (m && (!REPLY_DOMAIN || m[2].toLowerCase() === REPLY_DOMAIN)) {
      const id = fromHex(m[1].toLowerCase());
      if (/^[A-Za-z0-9]{10,40}$/.test(id)) return id;
    }
  }
  return null;
}

/** Plain text from an HTML body (only used when a reply has no text part). */
export function htmlToText(html: string): string {
  return html
    .replace(/<(style|script|head)[\s\S]*?<\/\1>/gi, '')
    .replace(/<blockquote[\s\S]*$/i, '') // everything quoted below the reply
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|li|h\d)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
}

/** Lines that start the quoted earlier email in common mail apps (English
 *  and Arabic Gmail, Outlook, Apple Mail, Yahoo). */
const QUOTE_START = [
  /^On .{4,200}wrote:\s*$/i,                    // Gmail / Apple Mail
  /^في .{4,200}(كتب|كتبت).{0,40}:\s*$/,           // Arabic Gmail
  /^-{2,}\s*Original Message\s*-{2,}/i,         // Outlook (desktop)
  /^-{2,}\s*الرسالة الأصلية\s*-{2,}/,
  /^_{10,}\s*$/,                                // Outlook.com / Hotmail
  /^(From|De|Von|من)\s*:\s.+/i,                 // header block of a quoted email
  /^Sent from my /i,                            // phone signature
  /^أُرسلت من /,
];

/** Only what the visitor wrote this time: the quoted receipt and anything
 *  after it are dropped, and blank-line runs are tidied. */
export function newTextOnly(body: string): string {
  const lines = body.replace(/\r\n?/g, '\n').split('\n');
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const next = (lines[i + 1] ?? '').trim();
    const quoteStarts = line.startsWith('>')
      || QUOTE_START.some(re => re.test(line))
      // Gmail sometimes wraps "On ... wrote:" over two lines.
      || (/^(On|في) /.test(line) && /(wrote|كتب|كتبت).{0,40}:\s*$/.test(`${line} ${next}`));
    if (quoteStarts) break;
    out.push(lines[i].trimEnd());
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** The clean email the hub receives for a visitor's reply. */
export function replyRelay(r: {
  fromEmail: string; fromName?: string; replyText: string; subject?: string;
  original?: { name: string; email: string; message: string; submittedAt?: string; ref: string };
  at?: Date;
}) {
  const who = r.original?.name || r.fromName || r.fromEmail;
  const ref = r.original ? 'JH-' + r.original.ref.slice(0, 8).toUpperCase() : '';
  const differentSender = r.original && r.original.email.toLowerCase() !== r.fromEmail.toLowerCase();

  const html = emailLayout({
    lang: 'en',
    title: 'Reply to a contact message',
    preheader: `${who} replied${ref ? ` (${ref})` : ''}: ${r.replyText.slice(0, 90)}`,
    footerNote: 'A visitor replied to their contact-form receipt. Only their new text is shown; the quoted receipt was removed. Replying to this email answers them directly.',
    body:
      heading(`${escapeHtml(who)} replied`) +
      paragraph(ref
        ? `A follow-up to contact message <strong>${ref}</strong>.`
        : 'A reply to a contact-form receipt (the original message could not be matched).') +
      infoTable('en', [
        ['From', `${escapeHtml(r.fromName ? `${r.fromName} ` : '')}<a href="mailto:${escapeHtml(r.fromEmail)}" style="color:#0f5a9f;">${escapeHtml(r.fromEmail)}</a>`],
        ['Received', escapeHtml(jeddahTime('en', r.at))],
        ...(ref ? [['Reference', ref] as [string, string]] : []),
        ...(differentSender ? [['Note', `Sent from a different address than the original message (${escapeHtml(r.original!.email)}).`] as [string, string]] : []),
      ]) +
      sectionTitle('Their reply') +
      quote('en', r.replyText || '(empty reply)') +
      (r.original
        ? sectionTitle(`Original message${r.original.submittedAt ? `, ${escapeHtml(jeddahTime('en', new Date(r.original.submittedAt)))}` : ''}`) +
          quote('en', r.original.message)
        : '') +
      `<div style="height:14px"></div>` +
      button(`mailto:${escapeHtml(r.fromEmail)}?subject=${encodeURIComponent(`Re: ${r.subject || 'Your message'}`)}`, `Reply to ${escapeHtml(who)}`) +
      paragraph(`<a href="${SITE}/en/dashboard/curator/messages" style="color:#0f5a9f;">Open Messages in the dashboard</a>`),
  });

  return {
    html,
    text: [
      `${who} replied${ref ? ` (${ref})` : ''}`, `From: ${r.fromEmail}`, '',
      'Their reply:', r.replyText, '',
      ...(r.original ? ['Original message:', r.original.message] : []),
    ].join('\n'),
    subject: `[Contact reply] ${who}${ref ? ` (${ref})` : ''}`,
    from: sender('Jeddah Hub Contact Form', process.env.CONTACT_EMAIL || 'contact@jeddahhub.org'),
  };
}
