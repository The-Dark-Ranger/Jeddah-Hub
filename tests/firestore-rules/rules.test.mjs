// Tests for firestore.rules, the site's security boundary. Run them with
// `npm run test:rules`: it starts the Firestore emulator (needs Java) for a
// throwaway "demo-" project, so the real database is never touched. Every
// test starts from the same fresh data (see seed()).
import { readFileSync } from 'node:fs';
import { after, before, beforeEach, describe, it } from 'node:test';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import {
  addDoc, arrayRemove, arrayUnion, collection, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc,
} from 'firebase/firestore';

let env;

const PEOPLE = {
  lead: { role: 'shaper', displayName: 'Lena Lead' },
  colead: { role: 'shaper', displayName: 'Cole Co' },
  mate: { role: 'shaper', displayName: 'Mo Mate' },
  author: { role: 'shaper', displayName: 'Ann Author' },
  cur: { role: 'curator', displayName: 'Cara Curator' },
  vice: { role: 'vice_curator', displayName: 'Vic Vice' },
  impact: { role: 'impact_officer', displayName: 'Ima Impact' },
};
const TEAM = [
  { userId: 'lead', role: 'Lead' }, { userId: 'colead', role: 'Co-Lead' },
  { userId: 'mate', role: 'Member' }, 'legacyUid',
];

async function seed() {
  await env.withSecurityRulesDisabled(async c => {
    const db = c.firestore();
    for (const [uid, d] of Object.entries(PEOPLE)) await setDoc(doc(db, 'users', uid), d);
    await setDoc(doc(db, 'initiatives', 'init1'), {
      title: 'Init', status: 'active', slug: 'init', color: '#123456', leads: ['lead', 'colead'], members: TEAM,
    });
    await setDoc(doc(db, 'blogs', 'pub'), { title: 'Hi', status: 'published', authorId: 'author', likedBy: ['mate'], visitorLikes: ['g_abc123xyz'] });
    await setDoc(doc(db, 'blogs', 'draft'), { title: 'Draft', content: 'c', status: 'draft', authorId: 'author', authorName: 'Ann Author', likedBy: [] });
    await setDoc(doc(db, 'media', 'AbCdEfGhIjKlMnOpQrSt'), { data: 'data:image/jpeg;base64,/9j/', contentType: 'image/jpeg', uploadedBy: 'mate', createdAt: 'x' });
    await setDoc(doc(db, 'role_change_requests', 'pending1'), {
      initiativeId: 'init1', targetUserId: 'mate', fromRole: 'Member', toRole: 'Co-Lead',
      requestedByUserId: 'lead', requestedByName: 'Lena Lead', status: 'pending', requestedAt: 'x',
    });
  });
}

const as = uid => env.authenticatedContext(uid, { email: `${uid}@test.dev` }).firestore();
const anon = () => env.unauthenticatedContext().firestore();
const init = db => doc(db, 'initiatives', 'init1');

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-jeddah-hub',
    firestore: { rules: readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8') },
  });
});
after(() => env.cleanup());
beforeEach(async () => { await env.clearFirestore(); await seed(); });

describe('initiative teams: what a lead can change', () => {
  it('accepts a join request (one plain Member added)', () =>
    assertSucceeds(updateDoc(init(as('lead')), { members: arrayUnion({ userId: 'x', role: 'Member' }) })));
  it('approves a member leaving', () =>
    assertSucceeds(updateDoc(init(as('lead')), { members: [TEAM[0], TEAM[1], TEAM[3]] })));
  it('removes an old bare-id member', () =>
    assertSucceeds(updateDoc(init(as('lead')), { members: TEAM.slice(0, 3) })));
  it('edits the description', () => assertSucceeds(updateDoc(init(as('lead')), { description: 'new' })));
  it('cannot add a "Lead" at the front or the end', async () => {
    await assertFails(updateDoc(init(as('lead')), { members: [{ userId: 'x', role: 'Lead' }, ...TEAM] }));
    await assertFails(updateDoc(init(as('lead')), { members: [...TEAM, { userId: 'x', role: 'Lead' }] }));
  });
  it('cannot add an entry with extra fields', () =>
    assertFails(updateDoc(init(as('lead')), { members: [...TEAM, { userId: 'x', role: 'Member', note: 'z' }] })));
  it('cannot remove a co-lead or themselves', async () => {
    await assertFails(updateDoc(init(as('lead')), { members: [TEAM[0], TEAM[2], TEAM[3]] }));
    await assertFails(updateDoc(init(as('lead')), { members: TEAM.slice(1) }));
  });
  it('cannot swap or re-badge members', async () => {
    await assertFails(updateDoc(init(as('lead')), { members: [TEAM[0], TEAM[1], { userId: 'x', role: 'Member' }, TEAM[3]] }));
    await assertFails(updateDoc(init(as('lead')), { members: [TEAM[0], TEAM[1], { userId: 'mate', role: 'Co-Lead' }, TEAM[3]] }));
  });
  it('cannot touch the leads list or the web address', async () => {
    await assertFails(updateDoc(init(as('lead')), { leads: arrayUnion('mate') }));
    await assertFails(updateDoc(init(as('lead')), { slug: 'someone-elses-project' }));
  });
  it('a curator can promote someone and change the web address', async () => {
    await assertSucceeds(updateDoc(init(as('cur')), { members: [TEAM[0], TEAM[1], { userId: 'mate', role: 'Co-Lead' }, TEAM[3]], leads: arrayUnion('mate') }));
    await assertSucceeds(updateDoc(init(as('cur')), { slug: 'renamed' }));
  });
});

describe('theme colours (they reach the page CSS)', () => {
  it('only hex colours, or none', async () => {
    await assertSucceeds(updateDoc(init(as('lead')), { color: '#aabbcc' }));
    await assertSucceeds(updateDoc(init(as('lead')), { color: null }));
    await assertFails(updateDoc(init(as('lead')), { color: 'red;position:fixed;inset:0' }));
    await assertFails(updateDoc(init(as('lead')), { color: 'url(https://evil.example/x.png)' }));
  });
  it('the same for curators, impact officers and proposals', async () => {
    await assertFails(setDoc(doc(as('cur'), 'initiatives', 'new1'), { title: 'N', color: '#fff;background:red' }));
    await assertSucceeds(setDoc(doc(as('cur'), 'initiatives', 'new1'), { title: 'N', color: '#0f5a9f' }));
    await assertSucceeds(updateDoc(init(as('impact')), { color: '#0f5a9f', title: 'Init 2' }));
    const proposal = { title: 'P', proposedBy: 'mate', proposedByName: 'Mo Mate', status: 'pending' };
    await assertFails(addDoc(collection(as('mate'), 'initiative_requests'), { ...proposal, color: 'red;x:y' }));
    await assertSucceeds(addDoc(collection(as('mate'), 'initiative_requests'), { ...proposal, color: '#123abc' }));
  });
});

describe('photos (media)', () => {
  it('can be read one at a time, never listed', async () => {
    await assertSucceeds(getDoc(doc(anon(), 'media', 'AbCdEfGhIjKlMnOpQrSt')));
    await assertFails(getDocs(collection(anon(), 'media')));
    await assertFails(getDocs(collection(as('mate'), 'media')));
  });
  it('are never written directly (uploads go through POST /api/media)', async () => {
    const photo = { data: 'data:image/jpeg;base64,/9j/', contentType: 'image/jpeg', createdAt: 'x' };
    await assertFails(addDoc(collection(as('mate'), 'media'), { ...photo, uploadedBy: 'mate' }));
    await assertFails(addDoc(collection(as('cur'), 'media'), { ...photo, uploadedBy: 'cur' }));
  });
  it('can be deleted by the uploader only (or a curator)', async () => {
    await assertFails(deleteDoc(doc(as('lead'), 'media', 'AbCdEfGhIjKlMnOpQrSt')));
    await assertSucceeds(deleteDoc(doc(as('mate'), 'media', 'AbCdEfGhIjKlMnOpQrSt')));
  });
});

describe('news posts and likes', () => {
  const editor = { title: 'New', content: 'Body', excerpt: 'Body', tags: ['a'], status: 'pending_review', updatedAt: 'x' };
  const newPost = { ...editor, status: 'draft', authorId: 'author', authorName: 'Ann Author', authorRole: 'shaper', createdAt: 'x', likedBy: [] };
  it('a member writes and saves their own post', async () => {
    await assertSucceeds(addDoc(collection(as('author'), 'blogs'), newPost));
    await assertSucceeds(updateDoc(doc(as('author'), 'blogs', 'draft'), editor));
  });
  it('a member cannot add likes, extra fields or publish', async () => {
    await assertFails(addDoc(collection(as('author'), 'blogs'), { ...newPost, likedBy: ['a', 'b'] }));
    await assertFails(addDoc(collection(as('author'), 'blogs'), { ...newPost, featured: true }));
    await assertFails(addDoc(collection(as('author'), 'blogs'), { ...newPost, status: 'published' }));
    await assertFails(updateDoc(doc(as('author'), 'blogs', 'draft'), { likedBy: ['a', 'b'] }));
    await assertFails(updateDoc(doc(as('author'), 'blogs', 'draft'), { status: 'published' }));
    await assertFails(updateDoc(doc(as('mate'), 'blogs', 'draft'), editor));
  });
  it('impact officers and curators publish', async () => {
    await assertSucceeds(addDoc(collection(as('impact'), 'blogs'), { ...newPost, authorId: 'impact', authorName: 'Ima Impact', authorRole: 'impact_officer', status: 'published' }));
    await assertSucceeds(updateDoc(doc(as('cur'), 'blogs', 'draft'), { status: 'published' }));
  });
  it('guests like and unlike with a real guest id only', async () => {
    await assertSucceeds(updateDoc(doc(anon(), 'blogs', 'pub'), { visitorLikes: arrayUnion('g_k3j4h5g6f7d8s9a0') }));
    await assertSucceeds(updateDoc(doc(anon(), 'blogs', 'pub'), { visitorLikes: arrayRemove('g_abc123xyz') }));
    await assertFails(updateDoc(doc(anon(), 'blogs', 'pub'), { visitorLikes: arrayUnion('g_' + 'x'.repeat(5000)) }));
    await assertFails(updateDoc(doc(anon(), 'blogs', 'pub'), { visitorLikes: arrayUnion(12345) }));
  });
  it('members like only as themselves', async () => {
    await assertSucceeds(updateDoc(doc(as('author'), 'blogs', 'pub'), { likedBy: arrayUnion('author') }));
    await assertSucceeds(updateDoc(doc(as('mate'), 'blogs', 'pub'), { likedBy: arrayRemove('mate') }));
    await assertFails(updateDoc(doc(as('author'), 'blogs', 'pub'), { likedBy: arrayUnion('cur') }));
  });
});

describe('role change requests (Roster)', () => {
  const request = (over = {}) => ({
    initiativeId: 'init1', initiativeTitle: 'Init', targetUserId: 'mate', targetUserName: 'Mo Mate',
    fromRole: 'Member', toRole: 'Co-Lead', requestedByUserId: 'lead', requestedByName: 'Lena Lead',
    status: 'pending', requestedAt: new Date().toISOString(), ...over,
  });
  const rcr = db => collection(db, 'role_change_requests');
  it('a lead asks to change a teammate\'s role', () => assertSucceeds(addDoc(rcr(as('lead')), request())));
  it('never for their own role, a non-team role, pre-approved, or in someone else\'s name', async () => {
    await assertFails(addDoc(rcr(as('lead')), request({ targetUserId: 'lead' })));
    await assertFails(addDoc(rcr(as('lead')), request({ toRole: 'curator' })));
    await assertFails(addDoc(rcr(as('lead')), request({ status: 'approved' })));
    await assertFails(addDoc(rcr(as('lead')), request({ requestedByName: 'Cara Curator' })));
    await assertFails(addDoc(rcr(as('lead')), request({ reviewedBy: 'lead' })));
  });
  it('someone who is not a lead of that initiative cannot ask', () =>
    assertFails(addDoc(rcr(as('mate')), request({ requestedByUserId: 'mate', requestedByName: 'Mo Mate' }))));
  it('only the requester and curators can read it', async () => {
    await assertSucceeds(getDoc(doc(as('lead'), 'role_change_requests', 'pending1')));
    await assertSucceeds(getDoc(doc(as('vice'), 'role_change_requests', 'pending1')));
    await assertFails(getDoc(doc(as('mate'), 'role_change_requests', 'pending1')));
    await assertFails(getDoc(doc(as('impact'), 'role_change_requests', 'pending1')));
  });
  it('only the Curator or Vice Curator review it, as themselves', async () => {
    const ref = db => doc(db, 'role_change_requests', 'pending1');
    const outcome = by => ({ status: 'approved', reviewedBy: by, reviewedAt: 'x' });
    await assertFails(updateDoc(ref(as('lead')), outcome('lead')));
    await assertFails(updateDoc(ref(as('impact')), outcome('impact')));
    await assertFails(updateDoc(ref(as('vice')), outcome('cur')));
    await assertFails(updateDoc(ref(as('vice')), { ...outcome('vice'), toRole: 'Lead' }));
    await assertSucceeds(updateDoc(ref(as('vice')), outcome('vice')));
  });
  it('the requester can withdraw it', () => assertSucceeds(deleteDoc(doc(as('lead'), 'role_change_requests', 'pending1'))));
});

describe('private data and roles', () => {
  it('signed-out visitors read none of the private collections', async () => {
    for (const name of ['users', 'role_assignments', 'contact_messages', 'newsletter_subscribers', 'rate_limits', 'activity_responses']) {
      await assertFails(getDocs(collection(anon(), name)));
    }
  });
  it('a member cannot give themselves a role', () =>
    assertFails(updateDoc(doc(as('mate'), 'users', 'mate'), { role: 'curator' })));
  it('only the Curator can assign the Curator role', async () => {
    // Assignments are keyed by the (lowercase) email they grant.
    const assign = (by, email, role) =>
      setDoc(doc(as(by), 'role_assignments', email), { email, role, status: 'pending', createdAt: 'x' });
    await assertFails(assign('vice', 'one@test.dev', 'curator'));
    await assertSucceeds(assign('vice', 'two@test.dev', 'shaper'));
    await assertSucceeds(assign('cur', 'three@test.dev', 'curator'));
  });
  it('forms are never written straight from a browser', async () => {
    await assertFails(addDoc(collection(anon(), 'contact_messages'), { name: 'x', message: 'y' }));
    await assertFails(addDoc(collection(anon(), 'newsletter_subscribers'), { email: 'a@b.co' }));
    await assertFails(addDoc(collection(as('mate'), 'activity_responses'), { activityId: 'a' }));
  });
});
