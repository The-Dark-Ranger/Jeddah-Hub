// Tests for firestore.rules, the site's security boundary. Run them with
// `npm run test:rules`: it starts the Firestore emulator (needs Java) for a
// throwaway "demo-" project, so the real database is never touched. Every
// test starts from the same fresh data (see seed()).
import { readFileSync } from 'node:fs';
import { after, before, beforeEach, describe, it } from 'node:test';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import {
  addDoc, arrayRemove, arrayUnion, collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where,
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
  norole: { displayName: 'Noor Norole' },
  // Roles saved by hand or by an older app, not in the canonical spelling.
  capcur: { role: 'Curator', displayName: 'Cap Curator' },
  spacevice: { role: 'Vice Curator', displayName: 'Spacey Vice' },
  spaceimpact: { role: 'Impact Officer', displayName: 'Ima Space' },
};
/** An inline (data URI) photo of about `n` characters, like the photo picker's fallback. */
const inlinePhoto = n => 'data:image/jpeg;base64,/9j/' + 'A'.repeat(n);
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
    await setDoc(doc(db, 'initiatives', 'mine'), { type: 'hub_activity', title: 'Mine', proposedBy: 'author' });
    await setDoc(doc(db, 'initiatives', 'teamAct'), { type: 'hub_activity', title: 'Team', initiativeId: 'init1' });
    await setDoc(doc(db, 'activity_change_requests', 'hubWide'), {
      changeType: 'create', activityId: null, initiativeId: '', activityTitle: 'Hub', payload: { title: 'Hub' },
      proposedBy: 'author', proposedByName: 'Ann Author', status: 'pending', requestedAt: 'x',
    });
    await setDoc(doc(db, 'activity_change_requests', 'teamReq'), {
      changeType: 'update', activityId: 'teamAct', initiativeId: 'init1', activityTitle: 'Team', payload: { active: false },
      proposedBy: 'lead', proposedByName: 'Lena Lead', status: 'pending', requestedAt: 'x',
    });
    await setDoc(doc(db, 'activity_change_requests', 'wasDeclined'), {
      changeType: 'create', activityId: null, initiativeId: '', activityTitle: 'No', payload: { title: 'No' },
      proposedBy: 'author', proposedByName: 'Ann Author', status: 'declined', requestedAt: 'x',
    });
    await setDoc(doc(db, 'activity_change_requests', 'wasApproved'), {
      changeType: 'create', activityId: null, initiativeId: '', activityTitle: 'Yes', payload: { title: 'Yes' },
      proposedBy: 'author', proposedByName: 'Ann Author', status: 'approved', requestedAt: 'x',
    });
    await setDoc(doc(db, 'media', 'AbCdEfGhIjKlMnOpQrSt'), { data: 'data:image/jpeg;base64,/9j/', contentType: 'image/jpeg', uploadedBy: 'mate', createdAt: 'x' });
    await setDoc(doc(db, 'role_change_requests', 'pending1'), {
      initiativeId: 'init1', targetUserId: 'mate', fromRole: 'Member', toRole: 'Co-Lead',
      requestedByUserId: 'lead', requestedByName: 'Lena Lead', status: 'pending', requestedAt: 'x',
    });
    const assignment = (email, role) => setDoc(doc(db, 'role_assignments', email), { email, role, status: 'pending', createdAt: 'x' });
    await assignment('boss@test.dev', 'curator');
    await assignment('oldboss@test.dev', 'Curator');
    await assignment('helper@test.dev', 'shaper');
    const member = { userId: 'mate', userEmail: 'mate@test.dev', userName: 'Mo Mate', status: 'pending', requestedAt: 'x' };
    await setDoc(doc(db, 'join_requests', 'jr1'), { initiativeId: 'init1', ...member });
    await setDoc(doc(db, 'leave_requests', 'lr1'), { initiativeId: 'init1', initiativeTitle: 'Init', ...member });
    const byLead = { initiativeId: 'init1', initiativeTitle: 'Init', targetUserId: 'mate', targetUserName: 'Mo Mate', requestedByUserId: 'lead', requestedByName: 'Lena Lead', status: 'pending', requestedAt: 'x' };
    await setDoc(doc(db, 'removal_requests', 'rr1'), byLead);
    await setDoc(doc(db, 'member_add_requests', 'ar1'), { ...byLead, targetUserId: 'author', targetUserName: 'Ann Author' });
  });
}

const nowSeconds = () => Math.floor(Date.now() / 1000);
/** A member's session: confirmed email, signed in a minute ago (unless the test says otherwise). */
const as = (uid, token = {}) =>
  env.authenticatedContext(uid, { email: `${uid}@test.dev`, email_verified: true, auth_time: nowSeconds() - 60, ...token }).firestore();
const anon = () => env.unauthenticatedContext().firestore();
const init = db => doc(db, 'initiatives', 'init1');
/** What the initiative form saves (InitiativeFormFields initiativeFormToDoc). */
const initiativeForm = (extra = {}) => ({
  title: 'Init', titleAr: null, description: 'What we do', descriptionAr: null, category: 'Environment',
  startDate: '2026-01-15', endDate: '', imageUrl: '/api/media/AbC123', images: ['/api/media/XyZ9'],
  stat: '120 trees planted', problem: 'p', objective: 'o', impact: 'i', impactAreas: ['Youth', 'Climate'], color: null, ...extra,
});
const many = (n, f) => Array.from({ length: n }, (_, i) => f(i));

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

describe('initiative content a lead saves: sizes and types', () => {
  const edit = data => updateDoc(init(as('lead')), data);
  const legacy = db => doc(db, 'initiatives', 'legacy');
  // Saved before these limits: photos kept inside the document, a long description.
  const old = { imageUrl: inlinePhoto(230000), images: [inlinePhoto(160000), inlinePhoto(140000)], description: 'x'.repeat(12000) };
  const seedLegacy = () => env.withSecurityRulesDisabled(c => setDoc(legacy(c.firestore()), {
    title: 'Old', status: 'active', leads: ['lead'], members: [{ userId: 'lead', role: 'Lead' }], ...old,
  }));

  it('the whole edit form, up to the limits', async () => {
    await assertSucceeds(edit(initiativeForm()));
    await assertSucceeds(edit(initiativeForm({ description: 'x'.repeat(10000), impactAreas: ['y'.repeat(100), 'Youth'] })));
  });
  it('an initiative with inline photos and older, longer text still saves', async () => {
    await seedLegacy();
    // The form sends every field back; only the title (and new fields) change.
    await assertSucceeds(updateDoc(legacy(as('lead')), initiativeForm({ title: 'Renamed', ...old })));
    // Adding an uploaded photo checks the whole gallery, inline photos included.
    await assertSucceeds(updateDoc(legacy(as('lead')), { images: [...old.images, '/api/media/New1'] }));
    // A cover whose upload failed is kept inline.
    await assertSucceeds(updateDoc(legacy(as('lead')), { imageUrl: inlinePhoto(250000) }));
  });
  it('pasted photo links, as typed', async () => {
    await assertSucceeds(edit({ imageUrl: ' https://example.org/a.jpg ' }));
    await assertSucceeds(edit({ imageUrl: 'www.example.org/a.jpg', images: ['https://example.org/b.jpg', '/api/media/Q1'] }));
    await assertSucceeds(edit({ imageUrl: '', images: [] }));
  });
  it('refuses photos the site would never show, or text posing as one', async () => {
    await assertFails(edit({ imageUrl: 'javascript:alert(1)' }));
    await assertFails(edit({ imageUrl: 'data:text/html;base64,PHNjcmlwdD4=' }));
    await assertFails(edit({ imageUrl: 'https://example.org/' + 'a'.repeat(2000) }));
    await assertFails(edit({ imageUrl: 12345 }));
    await assertFails(edit({ images: ['/api/media/ok', 'javascript:alert(1)'] }));
    await assertFails(edit({ images: ['/api/media/ok javascript:alert(1)'] }));
    await assertFails(edit({ images: ['/api/media/ok', 42] }));
    await assertFails(edit({ images: 'not-a-list' }));
    await assertFails(edit({ images: many(41, i => `/api/media/p${i}`) }));
  });
  it('refuses oversized or mistyped text', async () => {
    await assertFails(edit({ title: '' }));
    await assertFails(edit({ title: 'x'.repeat(301) }));
    await assertFails(edit({ description: 'x'.repeat(10001) }));
    await assertFails(edit({ problem: 'x'.repeat(10001) }));
    await assertFails(edit({ impact: { html: '<b>' } }));
    await assertFails(edit({ objective: 7 }));
    await assertFails(edit({ stat: 'x'.repeat(501) }));
    await assertFails(edit({ category: 'x'.repeat(201) }));
    await assertFails(edit({ startDate: 'x'.repeat(41) }));
    await assertFails(edit({ impactAreas: many(31, i => `area ${i}`) }));
    await assertFails(edit({ impactAreas: ['x'.repeat(101)] }));
    await assertFails(edit({ impactAreas: ['a,' + 'x'.repeat(150)] }));
    await assertFails(edit({ impactAreas: [42] }));
    await assertFails(edit({ impactAreas: 'Youth' }));
  });
});

describe('initiative proposals: sizes and types', () => {
  const propose = extra => addDoc(collection(as('mate'), 'initiative_requests'), {
    ...initiativeForm(), proposedBy: 'mate', proposedByName: 'Mo Mate', status: 'pending', requestedAt: new Date().toISOString(), ...extra,
  });
  it('a member proposes with the full form, photos uploaded or inline', async () => {
    await assertSucceeds(propose());
    await assertSucceeds(propose({ imageUrl: inlinePhoto(200000), images: [inlinePhoto(150000), '/api/media/Abc'] }));
  });
  it('refuses oversized, mistyped or too many', async () => {
    await assertFails(propose({ images: many(41, i => `/api/media/p${i}`) }));
    await assertFails(propose({ images: ['javascript:alert(1)'] }));
    await assertFails(propose({ imageUrl: 'x'.repeat(5000) }));
    await assertFails(propose({ impactAreas: many(31, i => `a${i}`) }));
    await assertFails(propose({ impactAreas: ['x'.repeat(101)] }));
    await assertFails(propose({ stat: 'x'.repeat(501) }));
    await assertFails(propose({ problem: 'x'.repeat(10001) }));
    await assertFails(propose({ objective: ['not', 'text'] }));
    await assertFails(propose({ impact: 'x'.repeat(10001) }));
    await assertFails(propose({ titleAr: 'x'.repeat(301) }));
    await assertFails(propose({ category: 7 }));
    await assertFails(propose({ requestedAt: 'x'.repeat(41) }));
  });
});

describe('Hub Activity proposals: photos and form sizes', () => {
  /** What the activity editor sends as `payload` (ActivityFormData). */
  const fullForm = (extra = {}) => ({
    title: 'Beach clean-up', eyebrow: 'Workshop', subtitle: 's', description: 'd', date: 'Fri 3 May', location: 'Corniche',
    ctaText: 'Join', ctaUrl: 'https://example.org', highlights: [{ name: 'Al-Balad', tag: 'Heritage' }], active: true, kind: 'workshop',
    customForm: { enabled: true, questions: [{ id: 'q1', label: 'Why?', type: 'text', options: [], required: false }], intro: 'Hi', collectName: 'optional', collectEmail: 'required' },
    feedbackForm: { enabled: false, questions: [], closed: true, collectName: 'optional', collectEmail: 'off' },
    imageUrl: inlinePhoto(200000), images: ['/api/media/AbC1', inlinePhoto(100000)], color: '#0f5a9f', ...extra,
  });
  const send = (payload, uid = 'mate', extra = {}) => addDoc(collection(as(uid), 'activity_change_requests'), {
    changeType: 'create', activityId: null, initiativeId: '', activityTitle: 'Beach clean-up', payload,
    proposedBy: uid, proposedByName: PEOPLE[uid].displayName, status: 'pending', requestedAt: new Date().toISOString(), ...extra,
  });
  const change = payload => send(payload, 'author', { changeType: 'update', activityId: 'mine' });

  it('the full editor form, photos uploaded or inline', () => assertSucceeds(send(fullForm())));
  it('older forms with extra settings, and one-click changes', async () => {
    await assertSucceeds(change(fullForm({ customForm: { enabled: true, questions: [], title: 'Old', submitLabel: 'Go', intro: 'x' } })));
    await assertSucceeds(change({ customForm: { enabled: true, questions: [], closed: true } }));
    await assertSucceeds(change({ archived: true, active: false }));
  });
  it('refuses too many highlights or questions, or a form that is not one', async () => {
    await assertFails(send(fullForm({ highlights: many(51, i => ({ name: `n${i}`, tag: 't' })) })));
    await assertFails(send(fullForm({ highlights: 'Al-Balad' })));
    await assertFails(send(fullForm({ customForm: { enabled: true, questions: many(51, i => ({ id: `q${i}`, label: 'x', type: 'text', required: false })) } })));
    await assertFails(send(fullForm({ feedbackForm: { enabled: true, questions: 'q' } })));
    await assertFails(send(fullForm({ feedbackForm: 'closed' })));
  });
  it('refuses photos the site would never show', async () => {
    await assertFails(send(fullForm({ imageUrl: 'javascript:alert(1)' })));
    await assertFails(send(fullForm({ imageUrl: 'x'.repeat(5000) })));
    await assertFails(send(fullForm({ images: ['/api/media/ok', 'vbscript:x'] })));
    await assertFails(send(fullForm({ images: many(41, i => `/api/media/p${i}`) })));
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

describe('news post photos', () => {
  const post = (extra = {}) => ({ title: 'T', content: 'C', status: 'draft', authorId: 'author', authorName: 'Ann Author', likedBy: [], ...extra });
  const newPost = (extra) => setDoc(doc(as('author'), 'blogs', 'p1'), post(extra));
  it('a member adds a cover and extra photos', async () => {
    await assertSucceeds(newPost({ imageUrl: '/api/media/AbC123', images: ['/api/media/XyZ9', 'https://example.org/a.jpg'] }));
    await assertSucceeds(updateDoc(doc(as('author'), 'blogs', 'draft'), { imageUrl: '/api/media/AbC123', images: [] }));
    await assertSucceeds(updateDoc(doc(as('author'), 'blogs', 'draft'), { imageUrl: '' }));
  });
  it('refuses a photo stored inside the post, or a non-web address', async () => {
    await assertFails(newPost({ imageUrl: 'data:image/jpeg;base64,/9j/AAAA' }));
    await assertFails(newPost({ imageUrl: 'javascript:alert(1)' }));
    await assertFails(newPost({ images: ['data:image/jpeg;base64,/9j/AAAA'] }));
    await assertFails(newPost({ images: ['/api/media/ok', 'javascript:alert(1)'] }));
    await assertFails(newPost({ images: ['/api/media/ok /api/media/two'] }));
    await assertFails(newPost({ images: 'not-a-list' }));
  });
  it('limits how many', () =>
    assertFails(newPost({ images: Array.from({ length: 13 }, (_, i) => `/api/media/p${i}`) })));
  it('still cannot publish by adding a photo', () =>
    assertFails(updateDoc(doc(as('author'), 'blogs', 'draft'), { imageUrl: '/api/media/AbC123', status: 'published' })));
});

describe('news post tags', () => {
  const save = tags => updateDoc(doc(as('author'), 'blogs', 'draft'), { tags });
  it('a member tags a post as the editor splits it', async () => {
    await assertSucceeds(save(['Education', 'Sustainability', 'التعليم، الاستدامة']));
    await assertSucceeds(save([]));
    await assertSucceeds(save(many(20, i => `tag${i}`)));
    await assertSucceeds(save(['x'.repeat(60)]));
    await assertSucceeds(addDoc(collection(as('author'), 'blogs'), {
      title: 'T', content: 'C', tags: ['Education'], status: 'draft', authorId: 'author', authorName: 'Ann Author', likedBy: [],
    }));
  });
  it('refuses long, empty, mistyped or too many tags', async () => {
    await assertFails(save(['x'.repeat(61)]));
    await assertFails(save(['a,' + 'x'.repeat(70)]));
    await assertFails(save(['ok', '']));
    await assertFails(save(['ok', 7]));
    await assertFails(save('Education'));
    await assertFails(save(many(21, i => `tag${i}`)));
  });
});

describe('Community Charter sign-off', () => {
  const sign = (uid, extra = {}) => setDoc(doc(as(uid), 'charter_signatures', uid), {
    uid, name: PEOPLE[uid]?.displayName, confirmed: true, signedAt: new Date().toISOString(), signedAtServer: serverTimestamp(), ...extra,
  });
  it('a member signs with their account name', () => assertSucceeds(sign('mate')));
  it('refuses any other name', async () => {
    await assertFails(sign('mate', { name: 'Someone Else' }));
    await assertFails(sign('mate', { name: 'Cara Curator' }));
  });
  it('refuses a missing tick or a made-up time', async () => {
    await assertFails(sign('mate', { confirmed: false }));
    await assertFails(sign('mate', { signedAtServer: new Date('2020-01-01') }));
  });
  it('refuses signing for someone else', () =>
    assertFails(setDoc(doc(as('lead'), 'charter_signatures', 'mate'), {
      uid: 'mate', name: 'Lena Lead', confirmed: true, signedAt: 'x', signedAtServer: serverTimestamp(),
    })));
  it('a signature cannot be changed; only a curator clears it', async () => {
    await sign('mate');
    await assertFails(updateDoc(doc(as('mate'), 'charter_signatures', 'mate'), { signedAt: '2020-01-01' }));
    await assertFails(deleteDoc(doc(as('mate'), 'charter_signatures', 'mate')));
    await assertSucceeds(deleteDoc(doc(as('vice'), 'charter_signatures', 'mate')));
  });
  it('only the member and the curatorship read it', async () => {
    await sign('mate');
    await assertSucceeds(getDoc(doc(as('mate'), 'charter_signatures', 'mate')));
    await assertSucceeds(getDoc(doc(as('impact'), 'charter_signatures', 'mate')));
    await assertFails(getDoc(doc(as('lead'), 'charter_signatures', 'mate')));
  });
});

describe('Hub Activity proposals', () => {
  const reqs = db => collection(db, 'activity_change_requests');
  const proposal = (uid, extra = {}) => ({
    changeType: 'create', activityId: null, initiativeId: '', activityTitle: 'Beach clean-up',
    payload: { title: 'Beach clean-up', kind: 'workshop', active: true, ctaUrl: 'https://example.org', color: '#0f5a9f' },
    proposedBy: uid, proposedByName: PEOPLE[uid]?.displayName, status: 'pending', requestedAt: new Date().toISOString(), ...extra,
  });
  const change = (uid, extra) => proposal(uid, { changeType: 'update', activityId: 'mine', payload: { active: false }, ...extra });
  const review = (uid, extra = {}) => ({ status: 'approved', reviewedAt: 'now', reviewedBy: uid, ...extra });
  const request = (db, id) => doc(db, 'activity_change_requests', id);

  it('any member proposes one for the whole hub', async () => {
    await assertSucceeds(addDoc(reqs(as('mate')), proposal('mate')));
    await assertSucceeds(addDoc(reqs(as('lead')), proposal('lead')));
  });
  it('someone with no role cannot', () => assertFails(addDoc(reqs(as('norole')), proposal('norole'))));
  it('naming an initiative requires leading it', async () => {
    await assertSucceeds(addDoc(reqs(as('lead')), proposal('lead', { initiativeId: 'init1' })));
    await assertFails(addDoc(reqs(as('mate')), proposal('mate', { initiativeId: 'init1' })));
  });
  it('always as themselves and always waiting', async () => {
    await assertFails(addDoc(reqs(as('mate')), proposal('mate', { status: 'approved' })));
    await assertFails(addDoc(reqs(as('mate')), proposal('mate', { proposedBy: 'cur' })));
    await assertFails(addDoc(reqs(as('mate')), proposal('mate', { proposedByName: 'Cara Curator' })));
  });
  it('checks what the proposal contains', async () => {
    const withPayload = payload => addDoc(reqs(as('mate')), proposal('mate', { payload }));
    await assertFails(withPayload({ title: 'x', type: 'initiative' }));
    await assertFails(withPayload({ title: 'x', slug: 'someone-elses' }));
    await assertFails(withPayload({ title: 'x', proposedBy: 'cur' }));
    await assertFails(withPayload({ title: 'x', ctaUrl: 'javascript:alert(1)' }));
    await assertFails(withPayload({ title: 'x', color: 'red;position:fixed' }));
    await assertFails(addDoc(reqs(as('mate')), proposal('mate', { extra: 'x' })));
  });
  it('changing a live activity: its proposer, or its initiative\'s lead', async () => {
    await assertSucceeds(addDoc(reqs(as('author')), change('author')));
    await assertFails(addDoc(reqs(as('mate')), change('mate')));
    await assertSucceeds(addDoc(reqs(as('lead')), change('lead', { activityId: 'teamAct', initiativeId: 'init1' })));
    await assertFails(addDoc(reqs(as('mate')), change('mate', { activityId: 'teamAct', initiativeId: 'init1' })));
  });
  it('cannot relabel an activity to pass the check', async () => {
    await assertFails(addDoc(reqs(as('lead')), change('lead', { activityId: 'mine', initiativeId: 'init1' })));
    await assertFails(addDoc(reqs(as('lead')), change('lead', { activityId: 'init1', initiativeId: 'init1' })));
  });
  it('the Curator and Vice Curator decide proposals for the whole hub', async () => {
    await assertSucceeds(updateDoc(request(as('vice'), 'hubWide'), review('vice', { reviewNote: 'Lovely' })));
    await assertFails(updateDoc(request(as('cur'), 'hubWide'), review('cur')));
  });
  it('an impact officer can read them but not decide', async () => {
    await assertSucceeds(getDoc(request(as('impact'), 'hubWide')));
    await assertFails(updateDoc(request(as('impact'), 'hubWide'), review('impact')));
    await assertSucceeds(updateDoc(request(as('impact'), 'teamReq'), review('impact')));
  });
  it('members cannot approve, not even their own', async () => {
    await assertFails(updateDoc(request(as('author'), 'hubWide'), review('author')));
    await assertFails(updateDoc(request(as('mate'), 'hubWide'), review('mate')));
  });
  it('a review names its real reviewer and changes nothing else', async () => {
    await assertFails(updateDoc(request(as('cur'), 'hubWide'), review('vice')));
    await assertFails(updateDoc(request(as('cur'), 'hubWide'), review('cur', { payload: { title: 'Changed' } })));
    await assertFails(updateDoc(request(as('cur'), 'hubWide'), review('cur', { reviewNote: 'x'.repeat(1001) })));
  });
  it('the sender corrects it only while it is waiting', async () => {
    await assertSucceeds(updateDoc(request(as('author'), 'hubWide'), { payload: { title: 'Better' }, activityTitle: 'Better' }));
    await assertFails(updateDoc(request(as('author'), 'hubWide'), { payload: { title: 'x', type: 'other' } }));
    await assertFails(updateDoc(request(as('author'), 'wasDeclined'), { payload: { title: 'x' } }));
    await assertFails(updateDoc(request(as('mate'), 'hubWide'), { payload: { title: 'x' } }));
  });
  it('the sender can remove a waiting or declined one, not an approved one', async () => {
    await assertSucceeds(deleteDoc(request(as('author'), 'hubWide')));
    await assertSucceeds(deleteDoc(request(as('author'), 'wasDeclined')));
    await assertFails(deleteDoc(request(as('author'), 'wasApproved')));
    await assertFails(deleteDoc(request(as('mate'), 'teamReq')));
  });
  it('only the sender and the curatorship read them', async () => {
    await assertSucceeds(getDocs(query(reqs(as('mate')), where('proposedBy', '==', 'mate'))));
    await assertFails(getDoc(request(as('mate'), 'hubWide')));
  });
  it('the old proposal form is closed', () =>
    assertFails(addDoc(collection(as('mate'), 'activity_requests'), {
      title: 'x', proposedBy: 'mate', proposedByName: 'Mo Mate', status: 'pending', requestedAt: 'x',
    })));
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

describe('roles, however they are written', () => {
  const user = (by, uid) => doc(as(by), 'users', uid);
  it('a vice curator cannot edit or remove a record saved as "Curator"', async () => {
    await assertFails(updateDoc(user('vice', 'capcur'), { bio: 'x' }));
    await assertFails(deleteDoc(user('vice', 'capcur')));
  });
  it('the Curator can', async () => {
    await assertSucceeds(updateDoc(user('cur', 'capcur'), { bio: 'x' }));
    await assertSucceeds(deleteDoc(user('cur', 'capcur')));
  });
  it('a vice curator cannot hand out the curator role in any spelling', async () => {
    await assertFails(updateDoc(user('vice', 'mate'), { role: 'Curator' }));
    await assertFails(updateDoc(user('vice', 'mate'), { role: 'CURATOR' }));
    await assertFails(updateDoc(user('vice', 'mate'), { role: 'superuser' }));
    await assertSucceeds(updateDoc(user('vice', 'mate'), { role: 'Impact Officer' }));
  });
  it('a vice curator saved as "Vice Curator" works as one, and no more', async () => {
    await assertSucceeds(updateDoc(user('spacevice', 'mate'), { bio: 'x' }));
    await assertFails(updateDoc(user('spacevice', 'cur'), { bio: 'x' }));
    await assertFails(deleteDoc(user('spacevice', 'capcur')));
  });
  it('an "Impact Officer" mirrors their role the way the app writes it, and only that', async () => {
    const pub = doc(as('spaceimpact'), 'public_profiles', 'spaceimpact');
    await assertSucceeds(setDoc(pub, { displayName: 'Ima Space', role: 'impact_officer' }));
    await assertFails(setDoc(pub, { role: 'curator' }, { merge: true }));
  });
});

describe('role assignments: the curator role stays with the Curator', () => {
  const ra = (by, email) => doc(as(by), 'role_assignments', email);
  it('a vice curator cannot remove a curator assignment, however it is spelled', async () => {
    await assertFails(deleteDoc(ra('vice', 'boss@test.dev')));
    await assertFails(deleteDoc(ra('vice', 'oldboss@test.dev')));
    await assertSucceeds(deleteDoc(ra('vice', 'helper@test.dev')));
    await assertSucceeds(deleteDoc(ra('cur', 'boss@test.dev')));
  });
  it('a curator records the login outcome in place', async () => {
    await assertSucceeds(updateDoc(ra('vice', 'helper@test.dev'), { account: 'created' }));
    await assertSucceeds(updateDoc(ra('cur', 'boss@test.dev'), { account: 'exists' }));
    await assertFails(updateDoc(ra('cur', 'helper@test.dev'), { account: 'hacked' }));
  });
  it('a vice curator changes the role of a shaper assignment', () =>
    assertSucceeds(updateDoc(ra('vice', 'helper@test.dev'), { role: 'alumni' })));
  it('only the Curator touches a curator assignment or grants the role', async () => {
    await assertFails(updateDoc(ra('vice', 'boss@test.dev'), { account: 'created' }));
    await assertFails(updateDoc(ra('vice', 'oldboss@test.dev'), { role: 'shaper' }));
    await assertFails(updateDoc(ra('vice', 'boss@test.dev'), { dismissed: true }));
    await assertFails(updateDoc(ra('vice', 'helper@test.dev'), { role: 'curator' }));
    await assertSucceeds(updateDoc(ra('cur', 'helper@test.dev'), { role: 'curator' }));
    await assertSucceeds(updateDoc(ra('cur', 'boss@test.dev'), { role: 'vice_curator' }));
  });
  it('only real roles, and nothing else changes', async () => {
    await assertFails(updateDoc(ra('cur', 'helper@test.dev'), { role: 'admin' }));
    await assertFails(updateDoc(ra('cur', 'helper@test.dev'), { role: 'Curator' }));
    await assertFails(updateDoc(ra('cur', 'helper@test.dev'), { email: 'other@test.dev' }));
    await assertFails(updateDoc(ra('cur', 'helper@test.dev'), { account: 'created', note: 'x' }));
  });
  it('nobody else changes one, not even the invitee', async () => {
    await assertFails(updateDoc(ra('impact', 'helper@test.dev'), { account: 'created' }));
    await assertFails(updateDoc(ra('mate', 'helper@test.dev'), { role: 'alumni' }));
    await assertFails(updateDoc(ra('helper', 'helper@test.dev'), { role: 'curator' }));
  });
  it('setting one aside still works', () =>
    assertSucceeds(updateDoc(ra('vice', 'helper@test.dev'), { dismissed: true, dismissedAt: new Date().toISOString() })));
});

describe('reviews of join, leave, removal and add requests', () => {
  const req = (by, coll, id) => doc(as(by), coll, id);
  it('curators and impact officers record the outcome, as the dashboards do', async () => {
    await assertSucceeds(updateDoc(req('cur', 'join_requests', 'jr1'), { status: 'rejected' }));
    await assertSucceeds(updateDoc(req('impact', 'leave_requests', 'lr1'), { status: 'approved' }));
    await assertSucceeds(updateDoc(req('impact', 'removal_requests', 'rr1'), { status: 'declined' }));
    await assertSucceeds(updateDoc(req('vice', 'member_add_requests', 'ar1'), { status: 'approved', reviewedBy: 'vice', reviewedAt: new Date().toISOString() }));
  });
  it('a review cannot rewrite the request', async () => {
    await assertFails(updateDoc(req('cur', 'join_requests', 'jr1'), { status: 'rejected', userId: 'cur' }));
    await assertFails(updateDoc(req('cur', 'leave_requests', 'lr1'), { initiativeId: 'other' }));
    await assertFails(updateDoc(req('impact', 'removal_requests', 'rr1'), { status: 'approved', targetUserId: 'lead' }));
    await assertFails(updateDoc(req('impact', 'member_add_requests', 'ar1'), { requestedByUserId: 'impact' }));
    await assertFails(updateDoc(req('cur', 'removal_requests', 'rr1'), { status: 'done' }));
    await assertFails(updateDoc(req('cur', 'member_add_requests', 'ar1'), { status: 'approved', reviewedBy: 'vice' }));
    await assertFails(updateDoc(req('cur', 'member_add_requests', 'ar1'), { status: 'approved', reviewedAt: 'x'.repeat(41) }));
  });
  it('a lead still declines a join request for their initiative', () =>
    assertSucceeds(updateDoc(req('lead', 'join_requests', 'jr1'), { status: 'rejected' })));
  it('nobody else reviews', () => assertFails(updateDoc(req('mate', 'removal_requests', 'rr1'), { status: 'approved' })));
});

describe('sessions: confirmed email, 14-day limit, signed out everywhere', () => {
  const ownDoc = db => getDoc(doc(db, 'users', 'mate'));
  it('a confirmed, recent sign-in gets in', () => assertSucceeds(ownDoc(as('mate'))));
  it('an unconfirmed email address gets nothing', async () => {
    await assertFails(ownDoc(as('mate', { email_verified: false })));
    await assertFails(getDoc(doc(as('cur', { email_verified: false }), 'users', 'mate')));
  });
  it('a sign-in older than 14 days gets nothing', () =>
    assertFails(ownDoc(as('mate', { auth_time: nowSeconds() - 15 * 86400 }))));
  it('a sign-in from before "sign out everywhere" gets nothing; a newer one does', async () => {
    await env.withSecurityRulesDisabled(c => setDoc(doc(c.firestore(), 'session_revocations', 'mate'), { at: nowSeconds() - 30 }));
    await assertFails(ownDoc(as('mate', { auth_time: nowSeconds() - 60 })));
    await assertSucceeds(ownDoc(as('mate', { auth_time: nowSeconds() - 5 })));
  });
  it('nobody can read or change the revocations', async () => {
    await assertFails(getDoc(doc(as('mate'), 'session_revocations', 'mate')));
    await assertFails(setDoc(doc(as('mate'), 'session_revocations', 'mate'), { at: 0 }));
    await assertFails(setDoc(doc(as('cur'), 'session_revocations', 'mate'), { at: 0 }));
  });
});
