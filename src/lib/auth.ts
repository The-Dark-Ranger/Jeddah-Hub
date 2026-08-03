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

      return {
        uid, email: data.email || email || null, role,
        displayName:   data.displayName   || null,
        displayNameAr: data.displayNameAr || undefined,
        photoURL:  data.photoURL  || undefined,
        bio:       data.bio       || undefined,
        linkedin:  data.linkedin  || undefined,
        twitter:   data.twitter   || undefined,
        instagram: data.instagram || undefined,
      };
    } else if (email) {
      let result = await lookupRoleAssignment(email);
      if (!result.role) result = await bootstrapFirstAdmin(email);
      const profile: UserProfile = { uid, email, role: result.role, displayName: null };
      await setDoc(docRef, { ...profile, createdAt: new Date().toISOString() });
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
