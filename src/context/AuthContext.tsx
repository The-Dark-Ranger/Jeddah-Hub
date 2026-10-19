'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { subscribeToAuthChanges, UserProfile, logout as firebaseLogout } from '@/lib/auth';

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  logout: () => Promise<void>;
  /** Apply a just-saved profile edit (e.g. a new name) to the signed-in user. */
  patchUser: (fields: Partial<UserProfile>) => void;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true, logout: async () => {}, patchUser: () => {} });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = subscribeToAuthChanges((profile) => {
      setUser(profile);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const logout = async () => {
    await firebaseLogout();
    setUser(null);
  };

  // The name on requests and posts is checked against the saved profile
  // (firestore.rules isMyName), so a renamed member's next request must
  // carry the new name without waiting for a reload.
  const patchUser = (fields: Partial<UserProfile>) => {
    setUser(prev => (prev ? { ...prev, ...fields } : prev));
  };

  return (
    <AuthContext.Provider value={{ user, loading, logout, patchUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
