/* Contact-form emails, sent from their own address:
 *  - hubNotification: the message, delivered to the hub inbox (replying
 *    answers the visitor);
 *  - senderCopy: a receipt for the visitor with a copy of what they sent,
 *    in the language of the site they wrote from. */
import { escapeHtml } from '@/lib/escapeHtml';
import { sender } from '@/lib/email';
import {
  type Lang, emailLayout, heading, paragraph, sectionTitle, infoTable, quote, steps, linkCards, button,
  siteUrl, jeddahTime, SITE,
} from './layout';
import { replyAddress } from './replies';

const ADDRESS = process.env.CONTACT_EMAIL || 'contact@jeddahhub.org';
/** Where contact-form messages are delivered. */
export const CONTACT_INBOX = process.env.CONTACT_INBOX || 'jeddahglobalshapers@gmail.com';

export type Topic = 'general' | 'partnership' | 'join' | 'media' | 'other';
const TOPICS: Record<Lang, Record<Topic, string>> = {
  en: { general: 'General Inquiry', partnership: 'Partnership', join: 'Joining the Hub', media: 'Media & Press', other: 'Other' },
  ar: { general: 'استفسار عام', partnership: 'شراكة', join: 'الانضمام إلى المركز', media: 'الإعلام والصحافة', other: 'أخرى' },
};
export const isTopic = (v: unknown): v is Topic => typeof v === 'string' && v in TOPICS.en;

export interface ContactMessage {
  name: string;
  email: string;
  topic: Topic;
  message: string;
  lang: Lang;
  /** The saved message's id, shown as a short reference number. */
  ref?: string;
  at?: Date;
}

/** A short, human-friendly reference (e.g. JH-7Q2K9DXA). */
const reference = (ref?: string) => (ref ? 'JH-' + ref.slice(0, 8).toUpperCase() : '');

/* ── To the hub inbox (always English, with the sender's language noted) ── */

export function hubNotification(m: ContactMessage) {
  const topic = TOPICS.en[m.topic];
  const ref = reference(m.ref);
  const name = escapeHtml(m.name), email = escapeHtml(m.email);
  const replySubject = encodeURIComponent(`Re: ${TOPICS[m.lang][m.topic]}${ref ? ` (${ref})` : ''}`);

  const html = emailLayout({
    lang: 'en',
    title: 'New contact message',
    preheader: `${m.name} wrote about ${topic}.`,
    footerNote: 'Sent from the contact form on jeddahhub.org. Replying to this email answers the sender directly. The message is also saved in Dashboard → Messages.',
    body:
      heading(`New message: ${escapeHtml(topic)}`) +
      paragraph(`<strong>${name}</strong> sent a message through the contact form${m.lang === 'ar' ? ', from the <strong>Arabic</strong> site. Consider replying in Arabic' : ''}.`) +
      infoTable('en', [
        ['From', name],
        ['Email', `<a href="mailto:${email}" style="color:#0f5a9f;">${email}</a>`],
        ['Topic', escapeHtml(topic)],
        ['Site language', m.lang === 'ar' ? 'Arabic (العربية)' : 'English'],
        ['Received', escapeHtml(jeddahTime('en', m.at))],
        ...(ref ? [['Reference', ref] as [string, string]] : []),
      ]) +
      sectionTitle('Message') +
      quote('en', m.message) +
      `<div style="height:14px"></div>` +
      button(`mailto:${email}?subject=${replySubject}`, `Reply to ${name}`) +
      paragraph(`<a href="${SITE}/en/dashboard/curator/messages" style="color:#0f5a9f;">Open Messages in the dashboard</a>`),
  });

  return {
    from: sender('Jeddah Hub Contact Form', ADDRESS),
    to: CONTACT_INBOX,
    replyTo: m.email,
    subject: `[Contact] ${topic}: ${m.name}${ref ? ` (${ref})` : ''}`,
    html,
    text: [
      `New contact message: ${topic}`, `From: ${m.name} <${m.email}>`,
      `Site language: ${m.lang === 'ar' ? 'Arabic' : 'English'}`, `Received: ${jeddahTime('en', m.at)}`,
      ...(ref ? [`Reference: ${ref}`] : []), '', m.message,
    ].join('\n'),
  };
}

/* ── To the visitor (their language) ── */

const COPY = {
  en: {
    from: 'Jeddah Hub',
    subject: (ref: string) => `We received your message${ref ? ` (${ref})` : ''}`,
    preheader: 'Thank you for contacting Jeddah Hub. Here is a copy of your message.',
    heading: (n: string) => `Thank you, ${n}. We received your message.`,
    intro: 'This is a copy of the message you sent through the contact form at jeddahhub.org. We typically respond within 2–3 business days.',
    summary: 'Summary',
    rows: { ref: 'Reference', topic: 'Topic', sent: 'Sent', email: 'We will reply to' },
    yourMessage: 'Your message',
    nextTitle: 'What happens next',
    next: [
      ['Our team reads your message', 'It goes straight to the Jeddah Hub team.'],
      ['We reply by email', 'You will hear from us at the address above.'],
      ['Need to add something?', 'Just reply to this email and it will reach us.'],
    ],
    exploreTitle: 'While you wait',
    explore: [
      ['🚀', 'Our initiatives', 'See what the hub is working on now.', '/projects'],
      ['📰', 'Latest news', 'Read the newest posts from the hub.', '/news'],
    ],
    cta: 'Visit Jeddah Hub',
    footer: (e: string) => `You received this because ${e} was used on the contact form at jeddahhub.org. If this wasn't you, you can ignore this email.`,
  },
  ar: {
    from: 'مركز جدة',
    subject: (ref: string) => `وصلتنا رسالتك${ref ? ` (${ref})` : ''}`,
    preheader: 'شكراً لتواصلك مع مركز جدة. إليك نسخة من رسالتك.',
    heading: (n: string) => `شكراً لك يا ${n}، وصلتنا رسالتك.`,
    intro: 'هذه نسخة من الرسالة التي أرسلتها عبر نموذج التواصل في jeddahhub.org. سنتواصل معك خلال يومين إلى ثلاثة أيام عمل.',
    summary: 'ملخص الرسالة',
    rows: { ref: 'رقم المرجع', topic: 'الموضوع', sent: 'وقت الإرسال', email: 'سنردّ على' },
    yourMessage: 'رسالتك',
    nextTitle: 'ماذا بعد؟',
    next: [
      ['يقرأ فريقنا رسالتك', 'تصل رسالتك مباشرةً إلى فريق مركز جدة.'],
      ['نردّ عليك بالبريد الإلكتروني', 'سيصلك ردّنا على العنوان المذكور أعلاه.'],
      ['تودّ إضافة شيء؟', 'ردّ على هذه الرسالة وستصلنا مباشرةً.'],
    ],
    exploreTitle: 'في الأثناء',
    explore: [
      ['🚀', 'مبادراتنا', 'تعرّف على ما يعمل عليه المركز الآن.', '/projects'],
      ['📰', 'آخر الأخبار', 'اقرأ أحدث منشورات المركز.', '/news'],
    ],
    cta: 'زر موقع مركز جدة',
    footer: (e: string) => `وصلتك هذه الرسالة لأن ${e} استُخدم في نموذج التواصل على jeddahhub.org. إن لم تكن أنت، يمكنك تجاهل هذه الرسالة.`,
  },
} as const;

export function senderCopy(m: ContactMessage) {
  const c = COPY[m.lang];
  const ref = reference(m.ref);
  const name = escapeHtml(m.name), email = escapeHtml(m.email);
  const topic = TOPICS[m.lang][m.topic];

  const html = emailLayout({
    lang: m.lang,
    title: c.subject(ref),
    preheader: c.preheader,
    footerNote: c.footer(email),
    body:
      heading(c.heading(name)) +
      paragraph(c.intro) +
      sectionTitle(c.summary) +
      infoTable(m.lang, [
        ...(ref ? [[c.rows.ref, ref] as [string, string]] : []),
        [c.rows.topic, escapeHtml(topic)],
        [c.rows.sent, escapeHtml(jeddahTime(m.lang, m.at))],
        [c.rows.email, email],
      ]) +
      sectionTitle(c.yourMessage) +
      quote(m.lang, m.message) +
      sectionTitle(c.nextTitle) +
      steps(c.next) +
      sectionTitle(c.exploreTitle) +
      linkCards(m.lang, c.explore.map(([i, t, d, path]) => [i, t, d, siteUrl(m.lang, path)] as const)) +
      `<div style="height:20px"></div>` +
      button(siteUrl(m.lang), c.cta),
  });

  return {
    from: sender(c.from, ADDRESS),
    to: m.email,
    // Replies to the receipt come back through the site, which forwards
    // just the new text to the hub (replies.ts); without that set up, they
    // go straight to the hub inbox.
    replyTo: replyAddress(m.ref) ?? CONTACT_INBOX,
    subject: c.subject(ref),
    html,
    text: [
      c.heading(m.name), '', c.intro, '',
      ...(ref ? [`${c.rows.ref}: ${ref}`] : []),
      `${c.rows.topic}: ${topic}`, `${c.rows.sent}: ${jeddahTime(m.lang, m.at)}`, '',
      `${c.yourMessage}:`, m.message, '',
      c.footer(m.email),
    ].join('\n'),
  };
}
