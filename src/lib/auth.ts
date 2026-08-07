import { auth, db } from './firebase';
import { signOut, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import {
  doc, getDoc, setDoc,
  collection, query, where, getDocs, limit
} from 'firebase/firestore';

export type UserRole = 'curator' | 'vice_curator' | 'impact_officer' | 'shaper' | 'alumni' | null;

export interface UserProfile {
  uid: string;
  email: string | null;
  role: UserRole;
  displayName: string | null;
  displayNameAr?: string;
  photoURL?: string;
  bio?: string;
  linkedin?: string;
  twitter?: string;
  instagram?: string;
}

interface RoleResult { role: UserRole; }

const PUBLIC_FIELDS = [
  'displayName', 'displayNameAr', 'photoURL', 'bio', 'linkedin', 'twitter', 'instagram', 'role',
] as const;

/**
 * Mirrors only the public-safe subset of a user's profile into
 * public_profiles/{uid} — never `email`. Public pages (About, homepage,
 * project member lists) read from that collection instead of `users`
 * directly, since firestore.rules has no way to redact a single field
 * from a doc read — the only way to keep email out of a publicly
 * readable document is to not put it in that document at all.
 * Best-effort: a failure here must never block the caller's own
 * users/{uid} write from succeeding.
 */
async function syncPublicProfile(uid: string, data: Partial<UserProfile>) {
  const subset: Record<string, unknown> = {};
  for (const key of PUBLIC_FIELDS) {
    if (data[key] !== undefined) subset[key] = data[key];
  }
  if (Object.keys(subset).length === 0) return;
  try {
    await setDoc(doc(db, 'public_profiles', uid), subset, { merge: true });
  } catch { /* non-fatal — public listing just stays stale until next sync */ }
}

async function bootstrapFirstAdmin(email: string): Promise<RoleResult> {
  try {
    const snap = await getDocs(query(collection(db, 'role_assignments'), limit(1)));
    if (snap.empty) {
      // Keyed by the lowercased email (not an auto-id) so the Firestore
      // rules' preassignedRole() can look this doc up directly by path
      // when the bootstrapped user applies their own curator role below.
      const normalizedEmail = email.toLowerCase().trim();
      await setDoc(doc(db, 'role_assignments', normalizedEmail), {
        email: normalizedEmail,
        role: 'curator',
        createdAt: new Date().toISOString(),
        addedBy: 'system-bootstrap',
      });
      return { role: 'curator' };
    }
  } catch { /* ignore */ }
  return { role: null };
}

async function lookupRoleAssignment(email: string): Promise<RoleResult> {
  try {
    const q = query(
      collection(db, 'role_assignments'),
      where('email', '==', email.toLowerCase().trim())
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      const data = snap.docs[0].data();
      return {
        role: ((data.role as string)?.toLowerCase().replace(/\s+/g, '_') as UserRole) || null,
      };
    }
  } catch (error) {
    console.error('Error checking role_assignments:', error);
  }
  return { role: null };
}

export async function getUserProfile(uid: string, email?: string | null): Promise<UserProfile | null> {
  try {
    const docRef = doc(db, 'users', uid);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      let role = ((data.role as string)?.toLowerCase().replace(/\s+/g, '_') as UserRole) || null;

      if (!role && (email || data.email)) {
        const target = (email || data.email) as string;
        let result = await lookupRoleAssignment(target);
        if (!result.role) result = await bootstrapFirstAdmin(target);
        if (result.role) {
          role = result.role;
          await setDoc(docRef, { role }, { merge: true });
        }
      }

      const profile = {
        uid, email: data.email || email || null, role,
        displayName:   data.displayName   || null,
        displayNameAr: data.displayNameAr || undefined,
        photoURL:  data.photoURL  || undefined,
        bio:       data.bio       || undefined,
        linkedin:  data.linkedin  || undefined,
        twitter:   data.twitter   || undefined,
        instagram: data.instagram || undefined,
      };
      // Self-healing: every existing member backfills their public_profiles
      // mirror the next time they load the site signed in, with no
      // migration script needed — see syncPublicProfile().
      void syncPublicProfile(uid, profile);
      return profile;
    } else if (email) {
      let result = await lookupRoleAssignment(email);
      if (!result.role) result = await bootstrapFirstAdmin(email);
      const profile: UserProfile = { uid, email, role: result.role, displayName: null };
      await setDoc(docRef, { ...profile, createdAt: new Date().toISOString() });
      void syncPublicProfile(uid, profile);
      return profile;
    }
  } catch (error) {
    console.error('Error fetching user profile:', error);
  }
  return null;
}

export function subscribeToAuthChanges(callback: (user: UserProfile | null) => void) {
  if (!auth) { callback(null); return () => {}; }
  return onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
    if (firebaseUser) {
      const profile = await getUserProfile(firebaseUser.uid, firebaseUser.email);
      callback(profile ?? {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        role: null,
        displayName: firebaseUser.displayName,
      });
    } else {
      callback(null);
    }
  });
}

export const logout = () => (auth ? signOut(auth) : Promise.resolve());
