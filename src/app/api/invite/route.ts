/* POST /api/invite (curators only): emails a member their invitation, with a
 * fresh one-time password if they have never signed in. */
import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/serverAuth';
import { escapeHtml } from '@/lib/escapeHtml';
import { isValidEmail } from '@/lib/validateEmail';
import { hasDeliverableDomainWithTimeout } from '@/lib/emailDeliverability';
import { readJsonBody, asString } from '@/lib/http';
import { isRateLimited } from '@/lib/rateLimit';
import { normalizeRole } from '@/lib/role';
import { getAuth } from 'firebase-admin/auth';
import { adminApp, generateTempPassword } from '@/lib/firebaseAdmin';
import { sendEmail, emailConfigured } from '@/lib/email';

const KNOWN_ROLES = new Set(['curator', 'vice_curator', 'impact_officer', 'shaper', 'alumni']);


export async function POST(req: NextRequest) {
  const caller = await requireRole(req, ['curator', 'vice_curator']);
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Even authenticated curators can only fire a bounded number of invite
  // emails, protects the Resend quota if a session is ever misused.
  if (isRateLimited(`invite:${caller.uid}`, 20, 60_000)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const body = await readJsonBody(req);
  const email = body?.email;
  if (typeof email !== 'string' || !isValidEmail(email)) {
    return NextResponse.json({ error: 'Valid email required' }, { status: 400 });
  }
  const displayName = asString(body?.displayName, 120);
  // Only known roles ever reach the email subject/body.
  const rawRole = typeof body?.role === 'string' ? normalizeRole(body.role) : '';
  const role = KNOWN_ROLES.has(rawRole) ? rawRole : 'shaper';
  if (!(await hasDeliverableDomainWithTimeout(email))) {
    return NextResponse.json({ error: 'Valid email required' }, { status: 400 });
  }

  if (!emailConfigured()) {
    return NextResponse.json({ ok: true, skipped: 'No RESEND_API_KEY configured' });
  }

  // A member who has never signed in gets a fresh one-time password with
  // the invite (nothing is stored; this email is the only copy). Anyone who
  // has signed in already has their own password and is just reminded.
  let tempPassword: string | null = null;
  const app = adminApp();
  if (app) {
    try {
      const record = await getAuth(app).getUserByEmail(email);
      if (!record.metadata.lastSignInTime) {
        tempPassword = generateTempPassword();
        await getAuth(app).updateUser(record.uid, { password: tempPassword });
      }
    } catch { /* no account yet: the email still invites them */ }
  }

  const roleLabel: Record<string, string> = {
    curator: 'Curator', vice_curator: 'Vice Curator',
    impact_officer: 'Impact Officer', shaper: 'Shaper', alumni: 'Alumni',
  };
  const roleName = escapeHtml(roleLabel[role] ?? 'Shaper');
  const firstName = escapeHtml(displayName?.split(' ')[0] || 'there');
  const loginUrl = 'https://jeddahhub.org/login';
  const safeEmail = escapeHtml(email);

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
              <strong>Global Shapers Community, Jeddah Hub</strong>. Your account is ready and waiting.
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
                <p style="margin:0 0 14px;font-size:15px;font-weight:700;color:#0f5a9f;">${roleName}</p>
                <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#0f172a;">Sign in with</p>
                <p style="margin:0;font-size:14px;color:#475569;line-height:1.7;">
                  Email: <strong>${safeEmail}</strong><br />
                  ${tempPassword
                    ? `One-time password: <strong style="font-family:Consolas,monospace;">${tempPassword}</strong>`
                    : 'Your own password'}
                </p>
                ${tempPassword ? '<p style="margin:12px 0 0;font-size:13px;color:#b45309;">You will be asked to choose your own password when you first sign in.</p>' : ''}
              </td></tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="background:#f8fafc;padding:24px 48px;border-top:1px solid #e2e8f0;">
            <p style="margin:0 0 8px;font-size:13px;color:#94a3b8;line-height:1.6;">
              Questions? Reach us at <a href="https://jeddahhub.org/contact" style="color:#0f5a9f;text-decoration:none;">jeddahhub.org/contact</a>
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

  const result = await sendEmail({ to: email, subject: `You've been invited to Jeddah Hub as ${roleName}`, html });
  if (!result.ok) return NextResponse.json({ error: 'Failed to send email' }, { status: 502 });
  return NextResponse.json({ ok: true });
}
