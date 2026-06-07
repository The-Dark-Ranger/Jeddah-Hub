import { auth, db } from './firebase';
import { signOut, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';

export type UserRole = 'curator' | 'vice_curator' | 'impact_officer' | 'shaper' | 'alumni' | null;

export interface UserProfile {
  uid: string;
  email: string | null;
  role: UserRole;
  displayName: string | null;
}

async function lookupRoleAssignment(email: string): Promise<UserRole> {
  try {
    const q = query(
      collection(db, 'role_assignments'),
      where('email', '==', email.toLowerCase().trim())
    );
    const snap = await getDocs(q);
    if (!snap.empty) return (snap.docs[0].data().role as UserRole) || null;
  } catch (error) {
    console.error('Error checking role_assignments:', error);
  }
  return null;
}

export async function getUserProfile(uid: string, email?: string | null): Promise<UserProfile | null> {
  try {
    const docRef = doc(db, 'users', uid);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      let role = (data.role as UserRole) || null;

      if (!role && (email || data.email)) {
        const target = (email || data.email) as string;
        const assigned = await lookupRoleAssignment(target);
        if (assigned) {
          role = assigned;
          await setDoc(docRef, { role }, { merge: true });
        }
      }

      return { uid, email: data.email || email || null, role, displayName: data.displayName || null };
    } else if (email) {
      const assignedRole = await lookupRoleAssignment(email);
      const profile: UserProfile = { uid, email, role: assignedRole, displayName: null };
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
