import { auth, db } from './firebase';
import { signOut, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import {
  doc, getDoc, setDoc, deleteDoc,
  collection, query, where, getDocs, addDoc
} from 'firebase/firestore';

export type UserRole = 'curator' | 'vice_curator' | 'impact_officer' | 'shaper' | 'alumni' | null;

export interface UserProfile {
  uid: string;
  email: string | null;
  role: UserRole;
  displayName: string | null;
  photoURL?: string;
  bio?: string;
  linkedin?: string;
  twitter?: string;
  instagram?: string;
}

interface RoleResult { role: UserRole; docId: string | null; }

async function bootstrapFirstAdmin(email: string): Promise<RoleResult> {
  try {
    const snap = await getDocs(collection(db, 'role_assignments'));
    if (snap.empty) {
      const ref = await addDoc(collection(db, 'role_assignments'), {
        email: email.toLowerCase().trim(),
        role: 'curator',
        createdAt: new Date().toISOString(),
        addedBy: 'system-bootstrap',
      });
      return { role: 'curator', docId: ref.id };
    }
  } catch { /* ignore */ }
  return { role: null, docId: null };
}

async function lookupRoleAssignment(email: string): Promise<RoleResult> {
  try {
    const q = query(
      collection(db, 'role_assignments'),
      where('email', '==', email.toLowerCase().trim())
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      return {
        role: ((snap.docs[0].data().role as string)?.toLowerCase() as UserRole) || null,
        docId: snap.docs[0].id,
      };
    }
  } catch (error) {
    console.error('Error checking role_assignments:', error);
  }
  return { role: null, docId: null };
}

async function applyAndClearAssignment(docRef: ReturnType<typeof doc>, role: UserRole, docId: string | null) {
  await setDoc(docRef, { role }, { merge: true });
  if (docId) {
    try { await deleteDoc(doc(db, 'role_assignments', docId)); } catch { /* ignore */ }
  }
}

export async function getUserProfile(uid: string, email?: string | null): Promise<UserProfile | null> {
  try {
    const docRef = doc(db, 'users', uid);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      let role = ((data.role as string)?.toLowerCase() as UserRole) || null;

      if (!role && (email || data.email)) {
        const target = (email || data.email) as string;
        let result = await lookupRoleAssignment(target);
        if (!result.role) result = await bootstrapFirstAdmin(target);
        if (result.role) {
          role = result.role;
          await applyAndClearAssignment(docRef, role, result.docId);
        }
      }

      return {
        uid, email: data.email || email || null, role,
        displayName: data.displayName || null,
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
      if (result.role && result.docId) {
        try { await deleteDoc(doc(db, 'role_assignments', result.docId)); } catch { /* ignore */ }
      }
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
