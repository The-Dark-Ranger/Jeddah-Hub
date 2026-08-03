import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/serverAuth';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || 'Jeddah Hub <onboarding@resend.dev>';

export async function POST(req: NextRequest) {
  const caller = await requireRole(req, ['curator', 'vice_curator']);
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { email, displayName, role } = await req.json();
  if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 });

  if (!RESEND_API_KEY) {
    return NextResponse.json({ ok: true, skipped: 'No RESEND_API_KEY configured' });
  }

  const roleLabel: Record<string, string> = {
    curator: 'Curator', vice_curator: 'Vice Curator',
    impact_officer: 'Impact Officer', shaper: 'Shaper', alumni: 'Alumni',
  };
  const roleName = roleLabel[role] ?? role ?? 'Shaper';
  const firstName = displayName?.split(' ')[0] || 'there';
  const loginUrl = 'https://jeddahhub.com/login';

  const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>You're Invited to Jeddah Hub</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

        <tr>
          <td style="background:linear-gradient(135deg,#0f5a9f 0%,#1a73e8 100%);padding:40px 48px 32px;">
            <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:rgba(255,255,255,0.75);letter-spacing:0.1em;text-transform:uppercase;">Global Shapers Community</p>
            <h1 style="margin:0;font-size:32px;font-weight:800;color:#ffffff;letter-spacing:-0.02em;">Jeddah Hub</h1>
            <p style="margin:6px 0 0;font-size:14px;color:rgba(255,255,255,0.75);">Jeddah, Saudi Arabia</p>
          </td>
        </tr>

        <tr>
          <td style="padding:40px 48px;">
            <h2 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#0f172a;">You're invited, ${firstName}!</h2>
            <p style="margin:0 0 20px;font-size:16px;line-height:1.75;color:#475569;">
              The Jeddah Hub curator has added you as a <strong>${roleName}</strong> in the
              <strong>Global Shapers Community — Jeddah Hub</strong>. Your account is ready and waiting.
            </p>
            <p style="margin:0 0 28px;font-size:16px;line-height:1.75;color:#475569;">
              Log in to access your dashboard, connect with fellow shapers, and start making an impact in Jeddah.
            </p>

            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
              <tr>
                <td align="center">
                  <a href="${loginUrl}" style="display:inline-block;background:#0f5a9f;color:#ffffff;font-weight:700;font-size:15px;text-decoration:none;padding:16px 40px;border-radius:10px;letter-spacing:-0.01em;">
                    Log In to Jeddah Hub →
                  </a>
                </td>
              </tr>
            </table>

            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:10px;padding:20px 24px;">
              <tr><td>
                <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#0f172a;">Your role</p>
                <p style="margin:0;font-size:15px;font-weight:700;color:#0f5a9f;">${roleName}</p>
              </td></tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="background:#f8fafc;padding:24px 48px;border-top:1px solid #e2e8f0;">
            <p style="margin:0 0 8px;font-size:13px;color:#94a3b8;line-height:1.6;">
              Questions? Reach us at <a href="https://jeddahhub.com/contact" style="color:#0f5a9f;text-decoration:none;">jeddahhub.com/contact</a>
            </p>
            <p style="margin:0;font-size:13px;color:#cbd5e1;">
              © ${new Date().getFullYear()} Global Shapers Community, Jeddah Hub · Jeddah, Saudi Arabia
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
        subject: `You've been invited to Jeddah Hub as ${roleName}`,
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
    console.error('Invite email error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
