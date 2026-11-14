import dns from 'node:dns/promises';

/**
 * Server-only, uses Node's dns module, so this must never be imported
 * from a 'use client' component. Checks whether an email's domain can
 * actually receive mail, catching syntactically-valid-but-fake addresses
 * (e.g. someone@dfgdf.com) that isValidEmail()'s format check can't.
 */
/** DNS answers that mean the domain really has no such record. Anything
 *  else (SERVFAIL, a refused or unreachable resolver) says nothing about
 *  the address, so it doesn't count against it. */
const NO_RECORD = new Set(['ENOTFOUND', 'ENODATA']);
const missing = (err: unknown) => NO_RECORD.has(String((err as { code?: unknown } | null)?.code));

async function hasDeliverableDomain(email: string): Promise<boolean> {
  const domain = email.split('@')[1];
  if (!domain) return false;

  // RFC 5321 implicit MX: a domain with no MX record can still receive mail
  // on its own A/AAAA record, so checking only MX would reject some real
  // (if unusually configured) domains.
  for (const lookup of [() => dns.resolveMx(domain), () => dns.resolve4(domain), () => dns.resolve6(domain)]) {
    try {
      if ((await lookup()).length > 0) return true;
    } catch (err) {
      if (!missing(err)) return true;
    }
  }
  return false;
}

/** Same check, but never blocks longer than timeoutMs, a slow/unreachable
 *  resolver shouldn't fail a legitimate submission, since this is a
 *  courtesy pre-check, not the app's sole line of defense. */
export async function hasDeliverableDomainWithTimeout(email: string, timeoutMs = 3000): Promise<boolean> {
  return Promise.race([
    hasDeliverableDomain(email),
    new Promise<boolean>(resolve => setTimeout(() => resolve(true), timeoutMs)),
  ]);
}
