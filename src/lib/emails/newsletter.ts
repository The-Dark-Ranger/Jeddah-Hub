/* Newsletter emails, in the language of the site they subscribed from and
 * from the newsletter's own address: the confirmation link a signup gets
 * first, then the welcome once they've confirmed. */
import { escapeHtml } from '@/lib/escapeHtml';
import { sender } from '@/lib/email';
import {
  type Lang, type Mark, bold, plain, emailLayout, heading, paragraph, sectionTitle, featureList, linkCards, button, siteUrl,
} from './layout';
import { CONTACT_INBOX } from './contact';
import { LOGO_ATTACHMENTS } from './logos';

const ADDRESS = process.env.NEWSLETTER_EMAIL || 'newsletter@jeddahhub.org';

const COPY = {
  en: {
    from: 'Jeddah Hub Newsletter',
    subject: 'Welcome to the Jeddah Hub newsletter',
    preheader: 'You are subscribed. Here is what to expect and where to start.',
    heading: "Welcome aboard! You're subscribed.",
    intro: (b: Mark) => `Thank you for joining the ${b('Jeddah Hub newsletter')}. You are now connected with a community of young leaders shaping the future of Jeddah through initiatives, events and grassroots action.`,
    subscribedAs: (e: string) => `Subscribed as <strong>${e}</strong>.`,
    expectTitle: 'What you will receive',
    expect: [
      ['🌱', 'New initiatives', 'Projects our Shapers launch across Jeddah, and how you can support them.'],
      ['🎉', 'Events and opportunities', 'Workshops, gatherings and calls for volunteers, as soon as they open.'],
      ['📰', 'Hub stories', 'Stories, reflections and updates written by our Shapers.'],
    ],
    startTitle: 'Start exploring',
    start: [
      ['🚀', 'Our initiatives', 'See what the hub is working on now.', '/projects'],
      ['📰', 'Latest news', 'Read the newest posts from the hub.', '/news'],
      ['🤝', 'Who we are', 'Meet the curatorship, Shapers and alumni.', '/about'],
      ['✨', 'Become a Shaper', 'Learn how to apply and join the hub.', '/become-a-shaper'],
    ],
    cta: 'Visit Jeddah Hub',
    footer: (e: string) => `You are receiving this because ${e} subscribed to the newsletter at jeddahhub.org.`,
    unsubscribe: 'Unsubscribe in one click',
    unsubscribeByReply: 'To unsubscribe, reply to this email with "unsubscribe".',
  },
  ar: {
    from: 'نشرة مركز جدة',
    subject: 'أهلاً بك في نشرة مركز جدة',
    preheader: 'تم اشتراكك بنجاح. إليك ما ستتلقاه ومن أين تبدأ.',
    heading: 'أهلاً بك، تم اشتراكك بنجاح!',
    intro: (b: Mark) => `شكراً لانضمامك إلى ${b('نشرة مركز جدة')}. أصبحت الآن على تواصل مع مجتمع من القادة الشباب يصنعون مستقبل جدة عبر المبادرات والفعاليات والعمل المجتمعي.`,
    subscribedAs: (e: string) => `البريد المشترك: <strong>${e}</strong>`,
    expectTitle: 'ما الذي ستتلقاه',
    expect: [
      ['🌱', 'مبادرات جديدة', 'المشاريع التي يطلقها صنّاعنا في جدة، وكيف يمكنك دعمها.'],
      ['🎉', 'فعاليات وفرص', 'ورش العمل واللقاءات وفرص التطوع فور الإعلان عنها.'],
      ['📰', 'قصص المركز', 'قصص وتأملات وأخبار يكتبها صنّاعنا.'],
    ],
    startTitle: 'ابدأ الاستكشاف',
    start: [
      ['🚀', 'مبادراتنا', 'تعرّف على ما يعمل عليه المركز الآن.', '/projects'],
      ['📰', 'آخر الأخبار', 'اقرأ أحدث منشورات المركز.', '/news'],
      ['🤝', 'من نحن', 'تعرّف على فريق الإشراف والصنّاع والخريجين.', '/about'],
      ['✨', 'كن صانعاً', 'اعرف كيف تتقدّم وتنضم إلى المركز.', '/become-a-shaper'],
    ],
    cta: 'زُر موقع مركز جدة',
    footer: (e: string) => `وصلتك هذه الرسالة لأن البريد ${e} مشترك في النشرة البريدية عبر jeddahhub.org.`,
    unsubscribe: 'إلغاء الاشتراك بنقرة واحدة',
    unsubscribeByReply: 'لإلغاء الاشتراك، ردّ على هذه الرسالة بكلمة «إلغاء».',
  },
} as const;

/* The confirmation that comes first (double opt-in): nobody is on the list
 * until the owner of the address presses its button, so the form can't put
 * someone else's address on the list. */
const CONFIRM = {
  en: {
    subject: 'Confirm your Jeddah Hub newsletter subscription',
    preheader: 'One step left: confirm your address to start receiving the newsletter.',
    heading: 'Confirm your subscription',
    intro: (e: string, b: Mark = bold) => `Someone, hopefully you, asked to receive the ${b('Jeddah Hub newsletter')} at ${b(e)}. Press the button to confirm and you're on the list.`,
    cta: 'Confirm my subscription',
    fallback: "If the button doesn't work, copy and paste this link into your browser:",
    expiry: 'This link works for 7 days.',
    footer: "If you didn't ask for this, ignore this email: you won't be subscribed, and you won't hear from us again.",
  },
  ar: {
    subject: 'أكّد اشتراكك في النشرة البريدية لمركز جدة',
    preheader: 'خطوة أخيرة: أكّد بريدك لتبدأ باستلام النشرة.',
    heading: 'أكّد اشتراكك',
    intro: (e: string, b: Mark = bold) => `طلب أحدهم، ونأمل أن تكون أنت، استلام ${b('النشرة البريدية لمركز جدة')} على البريد ${b(e)}. اضغط الزر للتأكيد، وسيُضاف بريدك إلى القائمة.`,
    cta: 'تأكيد اشتراكي',
    fallback: 'إن لم يعمل الزر، فانسخ هذا الرابط والصقه في متصفحك:',
    expiry: 'يعمل هذا الرابط لمدة ٧ أيام.',
    footer: 'إن لم تطلب ذلك، فتجاهل هذه الرسالة؛ لن يُضاف بريدك، ولن تصلك منا رسائل أخرى.',
  },
} as const;

export function newsletterConfirm(lang: Lang, email: string, url: string) {
  const c = CONFIRM[lang];
  const e = escapeHtml(email);
  const u = escapeHtml(url);
  const html = emailLayout({
    lang,
    title: c.subject,
    preheader: c.preheader,
    footerNote: c.footer,
    body:
      heading(c.heading) +
      paragraph(c.intro(`<span dir="ltr">${e}</span>`)) +
      button(u, c.cta) +
      paragraph(`<span style="font-size:13px;color:#64748b;">${c.fallback}<br><a href="${u}" style="color:#0f5a9f;word-break:break-all;" dir="ltr">${u}</a></span>`) +
      paragraph(`<span style="font-size:13px;color:#64748b;">${c.expiry}</span>`),
  });
  return {
    from: sender(COPY[lang].from, ADDRESS),
    to: email,
    subject: c.subject,
    html,
    text: [c.heading, '', c.intro(email, plain), '', `${c.cta}: ${url}`, '', c.expiry, '', c.footer].join('\n'),
    replyTo: CONTACT_INBOX,
    attachments: LOGO_ATTACHMENTS,
  };
}

/** Where a subscriber can leave the list: `page` for people (a page with a
 *  button, so link scanners can't unsubscribe anyone by opening it) and
 *  `oneClick` for mail apps' own Unsubscribe button (RFC 8058). */
export interface UnsubscribeLinks { page: string; oneClick: string }

export function newsletterWelcome(lang: Lang, email: string, unsubscribe?: UnsubscribeLinks) {
  const c = COPY[lang];
  const e = escapeHtml(email);
  const leave = unsubscribe
    ? `<a href="${escapeHtml(unsubscribe.page)}" style="color:#64748b;text-decoration:underline;">${c.unsubscribe}</a>`
    : c.unsubscribeByReply;
  const html = emailLayout({
    lang,
    title: c.subject,
    preheader: c.preheader,
    footerNote: `${c.footer(e)} ${leave}`,
    body:
      heading(c.heading) +
      paragraph(c.intro(bold)) +
      paragraph(c.subscribedAs(e)) +
      sectionTitle(c.expectTitle) +
      featureList(c.expect) +
      sectionTitle(c.startTitle) +
      linkCards(lang, c.start.map(([i, t, d, path]) => [i, t, d, siteUrl(lang, path)] as const)) +
      `<div style="height:20px"></div>` +
      button(siteUrl(lang), c.cta),
  });
  const text = [
    c.heading, '', c.intro(plain), '',
    c.expectTitle + ':', ...c.expect.map(([, t, d]) => `- ${t}: ${d}`), '',
    c.startTitle + ':', ...c.start.map(([, t, , path]) => `- ${t}: ${siteUrl(lang, path)}`), '',
    c.footer(email),
    unsubscribe ? `${c.unsubscribe}: ${unsubscribe.page}` : c.unsubscribeByReply,
  ].join('\n');

  const mailto = `<mailto:${CONTACT_INBOX}?subject=unsubscribe>`;
  const headers: Record<string, string> = unsubscribe
    ? { 'List-Unsubscribe': `<${unsubscribe.oneClick}>, ${mailto}`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' }
    : { 'List-Unsubscribe': mailto };
  return {
    from: sender(c.from, ADDRESS),
    to: email,
    subject: c.subject,
    html,
    text,
    replyTo: CONTACT_INBOX,
    headers,
    attachments: LOGO_ATTACHMENTS,
  };
}
