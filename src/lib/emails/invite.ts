/* The member invite: the email a curator sends from Role Assignments, with
 * the sign-in address and, for someone who has never signed in, a fresh
 * one-time password (shown nowhere else). In the curator's dashboard
 * language, sent from its own address. */
import { escapeHtml } from '@/lib/escapeHtml';
import { sender } from '@/lib/email';
import {
  type Lang, emailLayout, heading, paragraph, sectionTitle, infoTable, steps, button, siteUrl,
} from './layout';
import { CONTACT_INBOX } from './contact';
import { LOGO_ATTACHMENTS } from './logos';

const ADDRESS = process.env.MEMBERS_EMAIL || 'members@jeddahhub.org';

const ROLES: Record<Lang, Record<string, string>> = {
  en: { curator: 'Curator', vice_curator: 'Vice Curator', impact_officer: 'Impact Officer', shaper: 'Global Shaper', alumni: 'Alumni' },
  ar: { curator: 'منسق', vice_curator: 'نائب المنسق', impact_officer: 'مسؤول الأثر', shaper: 'صانع عالمي', alumni: 'خريج' },
};

const COPY = {
  en: {
    from: 'Jeddah Hub',
    subject: 'Your Jeddah Hub account is ready',
    preheader: 'Your sign-in details for the Jeddah Hub dashboard.',
    heading: (n: string) => `Welcome to Jeddah Hub${n ? `, ${n}` : ''}!`,
    intro: (r: string) => `You have been added to the Jeddah Hub dashboard as <strong>${r}</strong>. Sign in with the details below to see your hub, join initiatives, propose activities and write for the hub.`,
    details: 'Your sign-in details',
    email: 'Email', password: 'One-time password', role: 'Role',
    ownPassword: 'The password you already chose',
    tempNote: 'This password works for your first sign-in only. You will be asked to choose your own password straight away. Keep it private.',
    cta: 'Sign in to Jeddah Hub',
    nextTitle: 'Your first steps',
    next: [
      ['Sign in', 'Use the email and password above on the sign-in page.'],
      ['Choose your password', 'Pick a password only you know.'],
      ['Complete your profile', 'Add your photo, a short bio and your links; they appear on Who We Are.'],
      ['Sign the Community Charter', 'Read the charter and confirm it from your dashboard.'],
    ],
    help: 'Questions? Just reply to this email.',
    footer: (e: string) => `You received this because a Jeddah Hub curator added ${e} to the hub. If you weren't expecting it, you can ignore this email.`,
  },
  ar: {
    from: 'مركز جدة',
    subject: 'حسابك في مركز جدة جاهز',
    preheader: 'بيانات الدخول إلى لوحة تحكم مركز جدة.',
    heading: (n: string) => `أهلاً بك في مركز جدة${n ? ` يا ${n}` : ''}!`,
    intro: (r: string) => `أُضفت إلى لوحة تحكم مركز جدة بصفة <strong>${r}</strong>. سجّل الدخول بالبيانات أدناه لتتابع المركز، وتنضم إلى المبادرات، وتقترح الأنشطة، وتكتب للمركز.`,
    details: 'بيانات الدخول',
    email: 'البريد الإلكتروني', password: 'كلمة المرور المؤقتة', role: 'الدور',
    ownPassword: 'كلمة المرور التي اخترتها سابقاً',
    tempNote: 'تعمل كلمة المرور هذه لأول تسجيل دخول فقط، وسيُطلب منك اختيار كلمة مرورك الخاصة مباشرةً. احتفظ بها لنفسك.',
    cta: 'تسجيل الدخول إلى مركز جدة',
    nextTitle: 'خطواتك الأولى',
    next: [
      ['سجّل الدخول', 'استخدم البريد وكلمة المرور أعلاه في صفحة تسجيل الدخول.'],
      ['اختر كلمة مرورك', 'اختر كلمة مرور لا يعرفها غيرك.'],
      ['أكمل ملفك الشخصي', 'أضف صورتك ونبذة قصيرة وروابطك؛ ستظهر في صفحة من نحن.'],
      ['وقّع ميثاق المجتمع', 'اقرأ الميثاق وأكّد التزامك به من لوحة التحكم.'],
    ],
    help: 'لديك سؤال؟ ردّ على هذه الرسالة.',
    footer: (e: string) => `وصلتك هذه الرسالة لأن أحد منسقي مركز جدة أضاف ${e} إلى المركز. إن لم تكن تتوقعها، يمكنك تجاهلها.`,
  },
} as const;

export function memberInvite(m: { lang: Lang; email: string; name?: string | null; role: string; tempPassword: string | null }) {
  const c = COPY[m.lang];
  const role = ROLES[m.lang][m.role] ?? ROLES[m.lang].shaper;
  const first = escapeHtml((m.name || '').trim().split(/\s+/)[0] || '');
  const email = escapeHtml(m.email);
  const pw = m.tempPassword
    ? `<span dir="ltr" style="font-family:Consolas,'Courier New',monospace;font-size:15px;letter-spacing:.04em;white-space:nowrap;color:#0f172a;background:#eef4fb;padding:4px 8px;border-radius:6px;">${escapeHtml(m.tempPassword)}</span>`
    : escapeHtml(c.ownPassword);

  const html = emailLayout({
    lang: m.lang,
    title: c.subject,
    preheader: c.preheader,
    footerNote: c.footer(email),
    body:
      heading(c.heading(first)) +
      paragraph(c.intro(escapeHtml(role))) +
      sectionTitle(c.details) +
      infoTable(m.lang, [
        [c.email, `<span dir="ltr">${email}</span>`],
        [c.password, pw],
        [c.role, escapeHtml(role)],
      ]) +
      (m.tempPassword ? `<p style="margin:10px 0 0;font-size:13px;line-height:1.6;color:#b45309;">${c.tempNote}</p>` : '') +
      `<div style="height:18px"></div>` +
      button(siteUrl(m.lang, '/login'), c.cta) +
      sectionTitle(c.nextTitle) +
      steps(c.next) +
      paragraph(c.help),
  });

  return {
    from: sender(c.from, ADDRESS),
    to: m.email,
    replyTo: CONTACT_INBOX,
    subject: c.subject,
    html,
    attachments: LOGO_ATTACHMENTS,
    text: [
      c.heading(first).replace(/<[^>]+>/g, ''), '',
      c.intro(role).replace(/<[^>]+>/g, ''), '',
      `${c.email}: ${m.email}`,
      `${c.password}: ${m.tempPassword ?? c.ownPassword}`,
      `${c.role}: ${role}`, '',
      ...(m.tempPassword ? [c.tempNote, ''] : []),
      `${c.cta}: ${siteUrl(m.lang, '/login')}`, '',
      c.footer(m.email),
    ].join('\n'),
  };
}
