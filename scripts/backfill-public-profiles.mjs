#!/usr/bin/env node
/**
 * One-time backfill: copies the public-safe subset of every existing
 * users/{uid} doc into public_profiles/{uid}.
 *
 * Why this exists: the public_profiles collection (introduced to stop
 * `users` — which carries `email` — from being publicly readable, see
 * firestore.rules) is normally kept in sync by the app itself (see
 * syncPublicProfile() in src/lib/auth.ts) whenever a member signs in or
 * edits their profile. That self-healing mirror only fires going forward —
 * it does nothing for accounts that existed before the change and haven't
 * signed in since. This script closes that gap in one pass, using the
 * Admin SDK (which bypasses Firestore rules entirely) to read `users` and
 * write `public_profiles` directly.
 *
 * This script is NOT part of the Next.js app — nothing under src/ imports
 * it, so it's never bundled or deployed. Run it by hand, once, whenever
 * you want to close the backfill gap immediately instead of waiting for
 * members to sign back in.
 *
 * Setup:
 *   1. Firebase Console → Project Settings → Service Accounts →
 *      "Generate new private key" → downloads a JSON file.
 *   2. Save it somewhere it can never be committed. Naming it to match
 *      *serviceaccount*.json or *firebase-adminsdk*.json (already in
 *      .gitignore) is the easiest way to guarantee that.
 *   3. npm install   (picks up the firebase-admin devDependency)
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json \
 *     node scripts/backfill-public-profiles.mjs --dry-run
 *
 *   GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json \
 *     node scripts/backfill-public-profiles.mjs
 *
 * Delete the service-account JSON (or move it somewhere permanently
 * secure outside the repo) once you're done — it's a full-admin
 * credential, far more sensitive than anything else in this project.
 */

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Must exactly match PUBLIC_FIELDS in src/lib/auth.ts — this script and
// the app's own mirror logic need to stay in lockstep, or the backfill and
// the ongoing sync would silently disagree on what "public-safe" means.
const PUBLIC_FIELDS = [
  'displayName', 'displayNameAr', 'photoURL', 'bio',
  'linkedin', 'twitter', 'instagram', 'role',
];

const dryRun = process.argv.includes('--dry-run');

initializeApp({ credential: applicationDefault() });
const db = getFirestore();

function publicSubset(data) {
  const subset = {};
  for (const key of PUBLIC_FIELDS) {
    if (data[key] !== undefined) subset[key] = data[key];
  }
  return subset;
}

async function main() {
  console.log(dryRun ? 'Dry run — no writes will be made.\n' : 'Live run — writing to public_profiles.\n');

  const usersSnap = await db.collection('users').get();
  console.log(`Found ${usersSnap.size} users doc(s).`);

  const writer = db.bulkWriter();
  let backfilled = 0;
  let skipped = 0;

  for (const doc of usersSnap.docs) {
    const subset = publicSubset(doc.data());
    if (Object.keys(subset).length === 0) {
      skipped++;
      continue;
    }
    backfilled++;
    if (dryRun) {
      console.log(`[dry-run] would write public_profiles/${doc.id}:`, subset);
      continue;
    }
    writer.set(db.collection('public_profiles').doc(doc.id), subset, { merge: true });
  }

  if (!dryRun) await writer.close();

  console.log(`\nDone. ${backfilled} profile(s) ${dryRun ? 'would be' : ''} backfilled, ${skipped} skipped (no public fields).`);
}

main().catch(err => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
