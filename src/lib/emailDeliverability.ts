import dns from 'node:dns/promises';

/**
 * Server-only — uses Node's dns module, so this must never be imported
 * from a 'use client' component. Checks whether an email's domain can
 * actually receive mail, catching syntactically-valid-but-fake addresses
 * (e.g. someone@dfgdf.com) that isValidEmail()'s format check can't.
 */
export async function hasDeliverableDomain(email: string): Promise<boolean> {
  const domain = email.split('@')[1];
  if (!domain) return false;

  try {
    const mx = await dns.resolveMx(domain);
    if (mx.length > 0) return true;
  } catch { /* fall through to the A/AAAA fallback below */ }

  // RFC 5321 implicit MX: a domain with no MX record can still receive mail
  // on its own A/AAAA record — checking only MX would reject some real
  // (if unusually configured) domains.
  try {
    await dns.resolve4(domain);
    return true;
  } catch { /* try AAAA below */ }

  try {
    await dns.resolve6(domain);
    return true;
  } catch {
    return false;
  }
}

/** Same check, but never blocks longer than timeoutMs — a slow/unreachable
 *  resolver shouldn't fail a legitimate submission, since this is a
 *  courtesy pre-check, not the app's sole line of defense. */
export async function hasDeliverableDomainWithTimeout(email: string, timeoutMs = 3000): Promise<boolean> {
  return Promise.race([
    hasDeliverableDomain(email),
    new Promise<boolean>(resolve => setTimeout(() => resolve(true), timeoutMs)),
  ]);
}
