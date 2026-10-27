import { NextRequest, NextResponse } from 'next/server';
import { verifyRecaptchaToken } from '@/lib/serverRecaptcha';
import { isRateLimited, clientIp } from '@/lib/rateLimit';
import { isValidEmail } from '@/lib/validateEmail';
import { hasDeliverableDomainWithTimeout } from '@/lib/emailDeliverability';
import { readJsonBody } from '@/lib/http';
import { sendEmail, emailLayout } from '@/lib/email';

/* POST /api/newsletter/welcome: sends a new subscriber the welcome email,
 * in Arabic when they subscribed from the Arabic site. */

const COPY = {
  en: {
    subject: 'Welcome to the Jeddah Hub newsletter',
    heading: 'Welcome to the community!',
    intro: 'Thank you for subscribing to the <strong>Jeddah Hub newsletter</strong>. You are now connected with young leaders shaping the future of Jeddah through initiatives, events and community action.',
    expect: 'Here is what you will hear about first:',
    items: [
      ['🌱', 'New initiatives', 'The latest projects our Shapers are launching across Jeddah.'],
      ['📰', 'Hub stories', 'Stories and updates from our Shapers.'],
      ['🎉', 'Events and opportunities', 'Workshops, gatherings and ways to take part.'],
      ['🌍', 'Global updates', 'News from the Global Shapers Community worldwide.'],
    ],
    cta: 'Visit Jeddah Hub',
    footer: 'You are receiving this because you subscribed at <a href="https://jeddahhub.org" style="color:#0f5a9f;text-decoration:none;">jeddahhub.org</a>.',
    path: '/en',
  },
  ar: {
    subject: 'أهلاً بك في نشرة مجتمع جدة',
    heading: 'أهلاً بك في المجتمع!',
    intro: 'شكراً لاشتراكك في <strong>نشرة مجتمع جدة</strong>. أصبحت الآن على تواصل مع قادة شباب يصنعون مستقبل جدة عبر المبادرات والفعاليات والعمل المجتمعي.',
    expect: 'إليك ما ستعرفه أولاً بأول:',
    items: [
      ['🌱', 'مبادرات جديدة', 'أحدث المشاريع التي يطلقها صنّاعنا في جدة.'],
      ['📰', 'قصص المجتمع', 'قصص وأخبار من صنّاع التغيير لدينا.'],
      ['🎉', 'فعاليات وفرص', 'ورش عمل ولقاءات وطرق للمشاركة.'],
      ['🌍', 'أخبار عالمية', 'مستجدات مجتمع الصنّاع العالميين حول العالم.'],
    ],
    cta: 'زر موقع مجتمع جدة',
    footer: 'وصلتك هذه الرسالة لأنك اشتركت عبر <a href="https://jeddahhub.org/ar" style="color:#0f5a9f;text-decoration:none;">jeddahhub.org</a>.',
    path: '/ar',
  },
} as const;

export async function POST(req: NextRequest) {
  // This route sends a real outbound email per request, a token-farmed or
  // replayed recaptcha pass shouldn't translate into unbounded email volume
  // to arbitrary addresses. Best-effort, single-instance limiter, see
  // src/lib/rateLimit.ts for its limits.
  if (isRateLimited(`newsletter-welcome:${clientIp(req)}`, 5, 60_000)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const body = await readJsonBody(req);
  const email = body?.email;
  const recaptchaToken = body?.recaptchaToken;
  if (typeof email !== 'string' || !isValidEmail(email)) {
    return NextResponse.json({ error: 'Valid email required' }, { status: 400 });
  }
  // Defense in depth: the client is expected to pre-check via
  // /api/validate-email before ever reaching this route, but that's a
  // client-side gate a direct call can skip, so check again here, right
  // before actually sending anything.
  if (!(await hasDeliverableDomainWithTimeout(email))) {
    return NextResponse.json({ error: 'Valid email required' }, { status: 400 });
  }

  // Fail closed (matches /api/verify-recaptcha): a misconfigured/missing
  // secret must reject the request, not silently skip verification, this
  // is a public, unauthenticated route with no other abuse control, so a
  // skipped check would turn it into an open relay for arbitrary email.
  if (!process.env.RECAPTCHA_SECRET_KEY) {
    console.warn('[newsletter/welcome] RECAPTCHA_SECRET_KEY not configured, rejecting request');
    return NextResponse.json({ error: 'reCAPTCHA not configured' }, { status: 503 });
  }
  const passed = await verifyRecaptchaToken(recaptchaToken, { action: 'newsletter_subscribe' });
  if (!passed) return NextResponse.json({ error: 'reCAPTCHA verification failed' }, { status: 400 });

  const lang = body?.locale === 'ar' ? 'ar' : 'en';
  const c = COPY[lang];
  const html = emailLayout({
    lang,
    title: c.subject,
    footer: c.footer,
    body: `
      <h2 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#0f172a;">${c.heading}</h2>
      <p style="margin:0 0 18px;font-size:16px;line-height:1.8;color:#475569;">${c.intro}</p>
      <p style="margin:0 0 22px;font-size:16px;line-height:1.8;color:#475569;">${c.expect}</p>
      <table width="100%" cellpadding="0" cellspacing="0">
        ${c.items.map(([icon, title, desc]) => `
        <tr><td style="padding:0 0 18px;">
          <table cellpadding="0" cellspacing="0"><tr>
            <td style="width:44px;vertical-align:top;padding-top:2px;font-size:22px;">${icon}</td>
            <td>
              <p style="margin:0 0 4px;font-size:15px;font-weight:700;color:#0f172a;">${title}</p>
              <p style="margin:0;font-size:14px;line-height:1.6;color:#64748b;">${desc}</p>
            </td>
          </tr></table>
        </td></tr>`).join('')}
      </table>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;"><tr><td align="center">
        <a href="https://jeddahhub.org${c.path}" style="display:inline-block;background:#0f5a9f;color:#ffffff;font-weight:700;font-size:15px;text-decoration:none;padding:14px 36px;border-radius:10px;">${c.cta}</a>
      </td></tr></table>`,
  });

  const result = await sendEmail({ to: email, subject: c.subject, html });
  if (!result.ok) {
    return 'skipped' in result && result.skipped
      ? NextResponse.json({ ok: true, skipped: result.error })
      : NextResponse.json({ error: 'Failed to send email' }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
