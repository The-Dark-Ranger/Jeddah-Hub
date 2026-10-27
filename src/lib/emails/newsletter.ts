/* Newsletter emails: the welcome sent to a new subscriber, in the language
 * of the site they subscribed from. Sent from its own address. */
import { escapeHtml } from '@/lib/escapeHtml';
import { sender } from '@/lib/email';
import {
  type Lang, emailLayout, heading, paragraph, sectionTitle, featureList, linkCards, button, siteUrl,
} from './layout';
import { CONTACT_INBOX } from './contact';

const ADDRESS = process.env.NEWSLETTER_EMAIL || 'newsletter@jeddahhub.org';

const COPY = {
  en: {
    from: 'Jeddah Hub Newsletter',
    subject: 'Welcome to the Jeddah Hub newsletter',
    preheader: 'You are subscribed. Here is what to expect and where to start.',
    heading: 'Welcome aboard, you are subscribed!',
    intro: 'Thank you for joining the <strong>Jeddah Hub newsletter</strong>. You are now connected with a community of young leaders shaping the future of Jeddah through initiatives, events and grassroots action.',
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
    footer: (e: string) => `You are receiving this because ${e} subscribed to the newsletter at jeddahhub.org. To unsubscribe, reply to this email with "unsubscribe".`,
  },
  ar: {
    from: 'نشرة مركز جدة',
    subject: 'أهلاً بك في نشرة مركز جدة',
    preheader: 'تم اشتراكك بنجاح. إليك ما ستتلقاه ومن أين تبدأ.',
    heading: 'أهلاً بك، تم اشتراكك بنجاح!',
    intro: 'شكراً لانضمامك إلى <strong>نشرة مركز جدة</strong>. أصبحت الآن على تواصل مع مجتمع من القادة الشباب يصنعون مستقبل جدة عبر المبادرات والفعاليات والعمل المجتمعي.',
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
    cta: 'زر موقع مركز جدة',
    footer: (e: string) => `وصلتك هذه الرسالة لأن ${e} اشترك في النشرة عبر jeddahhub.org. لإلغاء الاشتراك، ردّ على هذه الرسالة بكلمة "إلغاء".`,
  },
} as const;

export function newsletterWelcome(lang: Lang, email: string) {
  const c = COPY[lang];
  const e = escapeHtml(email);
  const html = emailLayout({
    lang,
    title: c.subject,
    preheader: c.preheader,
    footerNote: c.footer(e),
    body:
      heading(c.heading) +
      paragraph(c.intro) +
      paragraph(c.subscribedAs(e)) +
      sectionTitle(c.expectTitle) +
      featureList(c.expect) +
      sectionTitle(c.startTitle) +
      linkCards(lang, c.start.map(([i, t, d, path]) => [i, t, d, siteUrl(lang, path)] as const)) +
      `<div style="height:20px"></div>` +
      button(siteUrl(lang), c.cta),
  });
  const text = [
    c.heading, '', c.intro.replace(/<[^>]+>/g, ''), '',
    c.expectTitle + ':', ...c.expect.map(([, t, d]) => `- ${t}: ${d}`), '',
    c.startTitle + ':', ...c.start.map(([, t, , path]) => `- ${t}: ${siteUrl(lang, path)}`), '',
    c.footer(email),
  ].join('\n');

  return {
    from: sender(c.from, ADDRESS),
    to: email,
    subject: c.subject,
    html,
    text,
    replyTo: CONTACT_INBOX,
    headers: { 'List-Unsubscribe': `<mailto:${CONTACT_INBOX}?subject=unsubscribe>` },
  };
}
