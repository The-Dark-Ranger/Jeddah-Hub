/* Server only. What the newsletter's emailed links carry, shared by the
 * routes that act on them (newsletter/confirm, newsletter/unsubscribe):
 * the subscription's id (a hash of the address) and a random token stored
 * with it, so only someone with the email can use the link. */
import { timingSafeEqual } from 'node:crypto';

export const LINK_ID_RE = /^[a-f0-9]{64}$/;
export const LINK_TOKEN_RE = /^[A-Za-z0-9_-]{20,64}$/;

/** How long a confirmation link works. */
export const CONFIRM_TTL_MS = 7 * 24 * 60 * 60_000;

/** Compares a link's token with the stored one in constant time. */
export const sameToken = (stored: unknown, given: string) =>
  typeof stored === 'string' && stored.length === given.length && timingSafeEqual(Buffer.from(stored), Buffer.from(given));
