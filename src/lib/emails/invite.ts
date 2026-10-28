/* The member invite: the email a curator sends from Role Assignments, with
 * the sign-in address and, for someone who has never signed in, a fresh
 * one-time password (shown nowhere else). In the curator's dashboard
 * language, sent from its own address. */
import { escapeHtml } from '@/lib/escapeHtml';
import { sender } from '@/lib/email';
import {
  type Lang, emailLayout, heading, paragraph, sectionTitle, infoTable, steps, button, siteUrl, jeddahTime, SITE,
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

/** The hub's own record that an invite went out (who, to whom, when), kept
 *  in the hub inbox for reference. Never contains the password. */
export function inviteRecord(r: {
  email: string; name?: string | null; role: string; lang: Lang; withPassword: boolean;
  sentBy: string; inviteCount: number; at?: Date;
}) {
  const role = ROLES.en[r.role] ?? ROLES.en.shaper;
  const who = r.name || r.email;
  const html = emailLayout({
    lang: 'en',
    title: 'Invite sent',
    preheader: `${who} was invited as ${role}.`,
    footerNote: "Sent automatically each time a curator sends an invite from Role Assignments, for the hub's records. The password itself is never included.",
    body:
      heading(`Invite sent: ${escapeHtml(who)}`) +
      paragraph('A member invitation was emailed from Role Assignments.') +
      infoTable('en', [
        ['Invited', `${r.name ? `${escapeHtml(r.name)}<br>` : ''}<span dir="ltr">${escapeHtml(r.email)}</span>`],
        ['Role', escapeHtml(role)],
        ['Sign-in details', r.withPassword ? 'A new one-time password (replaces any earlier one)' : 'Already signed in before; reminded to use their own password'],
        ['Email language', r.lang === 'ar' ? 'Arabic' : 'English'],
        ['Sent by', escapeHtml(r.sentBy)],
        ['Sent at', escapeHtml(jeddahTime('en', r.at))],
        ['Invites so far', String(r.inviteCount)],
      ]) +
      `<div style="height:14px"></div>` +
      button(`${SITE}/en/dashboard/curator/members`, 'Open Role Assignments'),
  });
  return {
    from: sender('Jeddah Hub Records', ADDRESS),
    to: CONTACT_INBOX,
    subject: `[Invite sent] ${who} (${role})`,
    html,
    attachments: LOGO_ATTACHMENTS,
    text: [
      `Invite sent: ${who}`, `Email: ${r.email}`, `Role: ${role}`,
      `Sign-in details: ${r.withPassword ? 'new one-time password' : 'own password (already signed in)'}`,
      `Email language: ${r.lang === 'ar' ? 'Arabic' : 'English'}`, `Sent by: ${r.sentBy}`,
      `Sent at: ${jeddahTime('en', r.at)}`, `Invites so far: ${r.inviteCount}`,
    ].join('\n'),
  };
}
