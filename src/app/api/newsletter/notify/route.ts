import { NextRequest, NextResponse } from 'next/server';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || 'Jeddah Hub <newsletter@jeddahhub.com>';

interface NewsPost {
  id: string;
  title: string;
  excerpt?: string;
  authorName?: string;
  tags?: string[];
  createdAt: string;
}

export async function POST(req: NextRequest) {
  const { subscribers, post, relatedPosts } = await req.json() as {
    subscribers: string[];
    post: NewsPost;
    relatedPosts?: NewsPost[];
  };

  if (!subscribers?.length || !post) {
    return NextResponse.json({ error: 'subscribers and post required' }, { status: 400 });
  }

  if (!RESEND_API_KEY) {
    return NextResponse.json({ ok: true, skipped: 'No RESEND_API_KEY configured' });
  }

  const postUrl = `https://jeddahhub.com/news/${post.id}`;
  const tag = post.tags?.[0] || 'Hub Update';

  const relatedHtml = relatedPosts && relatedPosts.length > 0
    ? `
    <tr><td style="padding:32px 48px 0;">
      <p style="margin:0 0 16px;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#94a3b8;">More from the Hub</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
        ${relatedPosts.slice(0, 2).map((rp, i) => `
        <tr>
          <td style="padding:16px 20px;${i > 0 ? 'border-top:1px solid #e2e8f0;' : ''}">
            <p style="margin:0 0 4px;font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#0f5a9f;">${rp.tags?.[0] || 'Hub Update'}</p>
            <p style="margin:0 0 6px;font-size:14px;font-weight:700;color:#0f172a;line-height:1.4;">
              <a href="https://jeddahhub.com/news/${rp.id}" style="color:#0f172a;text-decoration:none;">${rp.title}</a>
            </p>
            <p style="margin:0;font-size:13px;color:#64748b;line-height:1.5;">${(rp.excerpt || '').slice(0, 120)}${(rp.excerpt || '').length > 120 ? '…' : ''}</p>
          </td>
        </tr>`).join('')}
      </table>
    </td></tr>`
    : '';

  const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${post.title}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#0f5a9f 0%,#1a73e8 100%);padding:28px 48px;">
            <p style="margin:0;font-size:12px;font-weight:700;color:rgba(255,255,255,0.75);letter-spacing:0.1em;text-transform:uppercase;">Jeddah Hub · New from the community</p>
          </td>
        </tr>

        <!-- Category tag -->
        <tr>
          <td style="padding:32px 48px 0;">
            <span style="display:inline-block;background:#dbeafe;color:#0f5a9f;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;padding:4px 12px;border-radius:4px;">${tag}</span>
          </td>
        </tr>

        <!-- Title -->
        <tr>
          <td style="padding:16px 48px 0;">
            <h1 style="margin:0;font-size:28px;font-weight:800;color:#0f172a;line-height:1.2;letter-spacing:-0.02em;">${post.title}</h1>
          </td>
        </tr>

        <!-- Author -->
        <tr>
          <td style="padding:12px 48px 0;">
            <p style="margin:0;font-size:13px;color:#94a3b8;">By <strong style="color:#475569;">${post.authorName || 'Global Shaper'}</strong> · ${new Date(post.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
          </td>
        </tr>

        <!-- Excerpt -->
        <tr>
          <td style="padding:20px 48px 0;">
            <p style="margin:0;font-size:16px;line-height:1.75;color:#475569;">${post.excerpt || ''}</p>
          </td>
        </tr>

        <!-- CTA -->
        <tr>
          <td style="padding:28px 48px 0;">
            <a href="${postUrl}" style="display:inline-block;background:#0f5a9f;color:#ffffff;font-weight:700;font-size:15px;text-decoration:none;padding:14px 32px;border-radius:10px;">
              Read the full article →
            </a>
          </td>
        </tr>

        <!-- Related posts -->
        ${relatedHtml}

        <!-- Divider -->
        <tr><td style="padding:40px 48px 0;"><div style="height:1px;background:#e2e8f0;"></div></td></tr>

        <!-- Footer -->
        <tr>
          <td style="padding:24px 48px 32px;">
            <p style="margin:0 0 8px;font-size:13px;color:#94a3b8;line-height:1.6;">
              You're receiving this because you subscribed at <a href="https://jeddahhub.com" style="color:#0f5a9f;text-decoration:none;">jeddahhub.com</a>.
            </p>
            <p style="margin:0;font-size:13px;color:#cbd5e1;">
              © ${new Date().getFullYear()} Global Shapers Community — Jeddah Hub · Jeddah, Saudi Arabia
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const BATCH_SIZE = 50;
  const errors: string[] = [];

  for (let i = 0; i < subscribers.length; i += BATCH_SIZE) {
    const batch = subscribers.slice(i, i + BATCH_SIZE);
    try {
      const res = await fetch('https://api.resend.com/emails/batch', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(
          batch.map(to => ({
            from: FROM_EMAIL,
            to: [to],
            subject: `New on Jeddah Hub: ${post.title}`,
            html,
          }))
        ),
      });
      if (!res.ok) errors.push(await res.text());
    } catch (err) {
      errors.push(String(err));
    }
  }

  return NextResponse.json({ ok: errors.length === 0, errors });
}
