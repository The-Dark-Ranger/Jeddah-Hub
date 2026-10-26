'use client';

/* Who is signed in, for every page.
 *
 * Firebase (about 600 KB of script) is only loaded when it can matter: on
 * the login and dashboard pages, and on public pages when this device has a
 * member signed in. Visitors who never sign in don't download it at all,
 * so public pages load and respond faster on phones. */
import { createContext, useContext, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import type { UserProfile } from '@/lib/auth';

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  logout: () => Promise<void>;
  /** Apply a just-saved profile edit (e.g. a new name) to the signed-in user. */
  patchUser: (fields: Partial<UserProfile>) => void;
}

/** A hint (not a credential) that a member is signed in on this device, so
 *  public pages know whether to load Firebase to restore the session. */
const SESSION_HINT = 'jh-member';
function hasMemberSession(): boolean {
  try { return localStorage.getItem(SESSION_HINT) === '1'; } catch { return true; } // storage blocked: check anyway
}
function rememberMemberSession(signedIn: boolean) {
  try {
    if (signedIn) localStorage.setItem(SESSION_HINT, '1');
    else localStorage.removeItem(SESSION_HINT);
  } catch { /* storage blocked */ }
}

/** Pages that always need to know who is signed in. */
const isAuthPath = (path: string | null) => /\/(dashboard|login)(\/|$)/.test(path ?? '');

const AuthContext = createContext<AuthContextType>({ user: null, loading: true, logout: async () => {}, patchUser: () => {} });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [started, setStarted] = useState(false);
  const [resolved, setResolved] = useState(false);
  // On login/dashboard pages this is true from the very first render, so a
  // dashboard never decides "signed out" before the session was checked.
  const loading = !resolved && (started || isAuthPath(pathname));

  // Start the session check once it's needed: on an auth page, or when this
  // device has a member signed in. Re-evaluated as the visitor navigates.
  useEffect(() => {
    if (!started && (isAuthPath(pathname) || hasMemberSession())) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reacting to navigation
      setStarted(true);
    }
  }, [pathname, started]);

  useEffect(() => {
    if (!started) return;
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;
    import('@/lib/auth')
      .then(({ subscribeToAuthChanges }) => {
        if (cancelled) return;
        unsubscribe = subscribeToAuthChanges((profile) => {
          setUser(profile);
          setResolved(true);
          rememberMemberSession(!!profile);
        });
      })
      .catch(() => setResolved(true)); // offline or blocked: behave as signed out
    return () => { cancelled = true; unsubscribe?.(); };
  }, [started]);

  const logout = async () => {
    const { logout: firebaseLogout } = await import('@/lib/auth');
    await firebaseLogout();
    rememberMemberSession(false);
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
