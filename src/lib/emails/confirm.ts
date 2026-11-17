/* The email that confirms a member's address, sent at their first sign-in
 * (or whenever they ask for the link again) by /api/members/confirm-email.
 * It replaces Firebase's plain default email, which came from a
 * firebaseapp.com address in English only: this one comes from the members
 * address on jeddahhub.org, in the language of the sign-in page, and its
 * link opens jeddahhub.org. */
import { escapeHtml } from '@/lib/escapeHtml';
import { sender } from '@/lib/email';
import { type Lang, type Mark, bold, plain, emailLayout, heading, paragraph, button } from './layout';
import { CONTACT_INBOX } from './contact';
import { LOGO_ATTACHMENTS } from './logos';

const ADDRESS = process.env.MEMBERS_EMAIL || 'members@jeddahhub.org';

const COPY = {
  en: {
    from: 'Jeddah Hub',
    subject: 'Confirm your email address for Jeddah Hub',
    preheader: 'One step left: confirm your address to open your Jeddah Hub dashboard.',
    heading: (n: string) => `Confirm your email address${n ? `, ${n}` : ''}`,
    intro: (e: string, b: Mark = bold) => `You signed in to the Jeddah Hub dashboard as ${b(e)}. To keep every member's account safe, the dashboard opens once you confirm this address is yours.`,
    cta: 'Confirm my email address',
    fallback: "If the button doesn't work, copy and paste this link into your browser:",
    expiry: 'This link works only once. If it has expired, sign in again and ask for a new one.',
    footer: (e: string) => `You received this because someone signed in to the Jeddah Hub dashboard as ${e}. If it wasn't you, ignore this email: nothing changes without the link.`,
  },
  ar: {
    from: 'مركز جدة',
    subject: 'أكّد بريدك الإلكتروني في مركز جدة',
    preheader: 'خطوة أخيرة: أكّد بريدك لتفتح لوحة تحكم مركز جدة.',
    heading: (n: string) => `أكّد بريدك الإلكتروني${n ? ` يا ${n}` : ''}`,
    intro: (e: string, b: Mark = bold) => `سجّلت الدخول إلى لوحة تحكم مركز جدة بالبريد ${b(e)}. حفاظاً على أمان حسابات الأعضاء، تُفتح لوحة التحكم بعد أن تؤكد أن هذا البريد لك.`,
    cta: 'تأكيد بريدي الإلكتروني',
    fallback: 'إن لم يعمل الزر، فانسخ هذا الرابط والصقه في متصفحك:',
    expiry: 'يعمل هذا الرابط مرة واحدة فقط. إن انتهت صلاحيته، فسجّل الدخول مجدداً واطلب رابطاً جديداً.',
    footer: (e: string) => `وصلتك هذه الرسالة لأن أحداً سجّل الدخول إلى لوحة تحكم مركز جدة بالبريد ${e}. إن لم تكن أنت، فتجاهل هذه الرسالة؛ لن يتغير شيء دون الرابط.`,
  },
} as const;

export function confirmEmail(m: { lang: Lang; email: string; name?: string | null; url: string }) {
  const c = COPY[m.lang];
  const firstName = (m.name || '').trim().split(/\s+/)[0] || '';
  const email = escapeHtml(m.email);
  const url = escapeHtml(m.url);
  const html = emailLayout({
    lang: m.lang,
    title: c.subject,
    preheader: c.preheader,
    footerNote: c.footer(email),
    body:
      heading(c.heading(escapeHtml(firstName))) +
      paragraph(c.intro(`<span dir="ltr">${email}</span>`)) +
      button(url, c.cta) +
      paragraph(`<span style="font-size:13px;color:#64748b;">${c.fallback}<br><a href="${url}" style="color:#0f5a9f;word-break:break-all;" dir="ltr">${url}</a></span>`) +
      paragraph(`<span style="font-size:13px;color:#64748b;">${c.expiry}</span>`),
  });
  return {
    from: sender(c.from, ADDRESS),
    to: m.email,
    replyTo: CONTACT_INBOX,
    subject: c.subject,
    html,
    attachments: LOGO_ATTACHMENTS,
    text: [
      c.heading(firstName), '',
      c.intro(m.email, plain), '',
      `${c.cta}: ${m.url}`, '',
      c.expiry, '',
      c.footer(m.email),
    ].join('\n'),
  };
}
