import { NextRequest, NextResponse } from 'next/server';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || 'Jeddah Hub <newsletter@jeddahhub.com>';

export async function POST(req: NextRequest) {
  const { email } = await req.json();
  if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 });

  if (!RESEND_API_KEY) {
    return NextResponse.json({ ok: true, skipped: 'No RESEND_API_KEY configured' });
  }

  const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Welcome to Jeddah Hub</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#0f5a9f 0%,#1a73e8 100%);padding:40px 48px 32px;">
            <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:rgba(255,255,255,0.75);letter-spacing:0.1em;text-transform:uppercase;">Global Shapers Community</p>
            <h1 style="margin:0;font-size:32px;font-weight:800;color:#ffffff;letter-spacing:-0.02em;">Jeddah Hub</h1>
            <p style="margin:6px 0 0;font-size:14px;color:rgba(255,255,255,0.75);">Jeddah, Saudi Arabia</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:40px 48px;">
            <h2 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#0f172a;">Welcome to the community!</h2>
            <p style="margin:0 0 20px;font-size:16px;line-height:1.75;color:#475569;">
              Thank you for subscribing to the <strong>Jeddah Hub Newsletter</strong>. You've joined a community of driven young leaders who are shaping the future of Jeddah through innovation, collaboration, and grassroots action.
            </p>
            <p style="margin:0 0 28px;font-size:16px;line-height:1.75;color:#475569;">
              As a subscriber, you'll be the first to hear about:
            </p>

            <!-- Feature list -->
            <table width="100%" cellpadding="0" cellspacing="0">
              ${[
                ['🌱', 'New Initiatives', 'Discover the latest projects our shapers are launching across Jeddah.'],
                ['📰', 'Hub Stories', 'Inspiring stories, insights, and updates from our Global Shapers.'],
                ['🎉', 'Events & Opportunities', 'Workshops, summits, and ways to get involved in your community.'],
                ['🌍', 'Global Updates', 'News from the Global Shapers Community network worldwide.'],
              ].map(([icon, title, desc]) => `
              <tr>
                <td style="padding:0 0 20px;">
                  <table cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="width:48px;vertical-align:top;padding-top:2px;font-size:24px;">${icon}</td>
                      <td>
                        <p style="margin:0 0 4px;font-size:15px;font-weight:700;color:#0f172a;">${title}</p>
                        <p style="margin:0;font-size:14px;line-height:1.6;color:#64748b;">${desc}</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>`).join('')}
            </table>

            <!-- CTA -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;">
              <tr>
                <td align="center">
                  <a href="https://jeddahhub.com" style="display:inline-block;background:#0f5a9f;color:#ffffff;font-weight:700;font-size:15px;text-decoration:none;padding:14px 36px;border-radius:10px;">
                    Visit Jeddah Hub →
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;padding:24px 48px;border-top:1px solid #e2e8f0;">
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

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [email],
        subject: 'Welcome to Jeddah Hub Newsletter 🌍',
        html,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('Resend error:', err);
      return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Email send error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
