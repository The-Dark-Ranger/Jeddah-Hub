/** Firestore `role` has been written with several casing/spacing variants
 *  over time ("Vice Curator", "vice curator", "vice_curator", ...).
 *  Normalizing once, here, is what lets every role check in the app compare
 *  against a single canonical form ('vice_curator') regardless of which
 *  variant is actually stored. No imports — safe to use from both
 *  client code (lib/auth.ts) and server-only code (lib/serverAuth.ts). */
export function normalizeRole(role: string | null | undefined): string {
  return typeof role === 'string' ? role.toLowerCase().replace(/\s+/g, '_') : '';
}
