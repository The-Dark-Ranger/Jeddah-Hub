/* Made-up members and content for the browser tests, written to the emulators
 * before the tests start (Playwright's globalSetup). */
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { PEOPLE, PHOTO_ID, PHOTO_URI, PUBLISHED_POST } from './helpers';

export default async function seed() {
  // A safety catch: the Admin SDK would otherwise reach for a real project.
  process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8085';
  process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
  const app = getApps()[0] ?? initializeApp({ projectId: 'demo-jeddah-hub' });
  const auth = getAuth(app);
  const db = getFirestore(app);

  for (const p of Object.values(PEOPLE)) {
    await auth.createUser({ uid: p.uid, email: p.email, password: p.password, displayName: p.name });
    await db.doc(`users/${p.uid}`).set({
      uid: p.uid, email: p.email, role: p.role, displayName: p.name,
      ...(p.nameAr ? { displayNameAr: p.nameAr } : {}), createdAt: '2026-01-01T00:00:00.000Z',
    });
    await db.doc(`public_profiles/${p.uid}`).set({ displayName: p.name, role: p.role });
  }

  await db.doc(`media/${PHOTO_ID}`).set({
    data: PHOTO_URI, contentType: 'image/jpeg', uploadedBy: PEOPLE.curator.uid, createdAt: '2026-01-01T00:00:00.000Z',
  });

  await db.doc('initiatives/green-jeddah').set({
    title: 'Green Jeddah', description: 'Planting trees along the corniche.', category: 'Environment',
    status: 'active', slug: 'green-jeddah', members: [{ userId: PEOPLE.lead.uid, role: 'Lead' }], leads: [PEOPLE.lead.uid],
  });

  await db.doc('initiatives/clean-shores').set({
    title: 'Clean Shores',
    description: 'Monthly beach clean-ups along the Red Sea coast, run with local schools and volunteers, with every kilo of waste recorded and shared with the city so the next clean-up goes where it is needed most.',
    category: 'Environment', status: 'active', slug: 'clean-shores', stat: '2 tonnes of waste collected',
    members: [{ userId: PEOPLE.lead.uid, role: 'Member' }, { userId: PEOPLE.shaper.uid, role: 'Member' }],
  });

  await db.doc('blogs/seeded-post').set({
    ...PUBLISHED_POST, status: 'published', authorId: PEOPLE.curator.uid, authorName: PEOPLE.curator.name,
    authorRole: 'curator', createdAt: '2026-02-01T00:00:00.000Z', likedBy: [],
  });

  await db.doc('settings/charter').set({ requireSignature: true });

  // Compile the most used pages up front: the dev server builds each page on
  // its first visit, which could otherwise run into a test's time limit.
  for (const path of ['/en', '/en/login', '/en/dashboard', '/en/dashboard/shaper/profile', '/en/dashboard/shaper/activities', '/en/dashboard/curator/activities', '/en/news', '/en/news/trees-along-the-corniche']) {
    await fetch(`http://localhost:3100${path}`).catch(() => {});
  }
}
