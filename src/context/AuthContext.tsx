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
import { clearAllDrafts } from '@/lib/drafts';
import { IDLE_LIMIT_MS, lastActive, markActive, noteEndedElsewhere, readKeep, setSignOutReason, type SignOutReason } from '@/lib/sessionPolicy';

/** True while this tab is signing the member out on purpose. */
let signingOut = false;

interface AuthContextType {
  user: UserProfile | null;
  /** Signed in, but the email address isn't confirmed yet: no access until it is. */
  pendingEmail: string | null;
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

const AuthContext = createContext<AuthContextType>({ user: null, pendingEmail: null, loading: true, logout: async () => {}, patchUser: () => {} });

/** How often an open page checks the session is still allowed (a new
 *  password or a removal ends it), on top of every return to the tab. */
const CHECK_EVERY_MS = 5 * 60_000;
const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'scroll', 'touchstart'] as const;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
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
        unsubscribe = subscribeToAuthChanges((profile, pending) => {
          // A session kept on this device is gone though nobody signed out
          // here: it was ended elsewhere, so the login page can say so.
          if (!profile && !pending && !signingOut && hasMemberSession() && readKeep()) noteEndedElsewhere();
          setUser(profile);
          setPendingEmail(pending);
          setResolved(true);
          rememberMemberSession(!!profile);
        });
      })
      .catch(() => setResolved(true)); // offline or blocked: behave as signed out
    return () => { cancelled = true; unsubscribe?.(); };
  }, [started]);

  const logout = async () => {
    const { logout: firebaseLogout } = await import('@/lib/auth');
    signingOut = true;
    rememberMemberSession(false);
    try { await firebaseLogout(); } finally { signingOut = false; }
    clearAllDrafts(); // unsaved writing must not outlive the session on a shared device
    setUser(null);
    setPendingEmail(null);
  };

  // While signed in: end the session when it's no longer allowed. A new
  // password or a removal (checked every few minutes and whenever the tab
  // comes back), 14 days since signing in, or, on a shared computer
  // ("Keep me signed in" unticked), 30 minutes without activity.
  const signedIn = !!user;
  useEffect(() => {
    if (!signedIn) return;
    const keep = readKeep();
    let ending = false;
    const end = async (reason: SignOutReason) => {
      if (ending) return;
      ending = true;
      setSignOutReason(reason);
      await logout();
    };
    const idle = () => !keep && lastActive() > 0 && Date.now() - lastActive() > IDLE_LIMIT_MS;
    let lastCheck = Date.now();
    const check = async (soon = CHECK_EVERY_MS) => {
      if (idle()) return end('idle');
      if (Date.now() - lastCheck < soon) return;
      lastCheck = Date.now();
      const [{ auth }, { checkSession }] = await Promise.all([import('@/lib/firebase'), import('@/lib/auth')]);
      const current = auth?.currentUser;
      if (!current) return;
      const reason = await checkSession(current, true);
      if (reason) await end(reason);
    };

    // A tab reopened long after its last use ends straight away.
    if (idle()) void end('idle');
    else if (!keep && lastActive() === 0) markActive();
    let lastMark = 0;
    const onActivity = () => {
      if (Date.now() - lastMark < 15_000) return;
      lastMark = Date.now();
      if (idle()) void end('idle');
      else markActive();
    };
    const onVisible = () => { if (document.visibilityState === 'visible') void check(30_000); };
    if (!keep) ACTIVITY_EVENTS.forEach(e => window.addEventListener(e, onActivity, { passive: true }));
    document.addEventListener('visibilitychange', onVisible);
    const timer = setInterval(() => void check(), 60_000);
    return () => {
      ACTIVITY_EVENTS.forEach(e => window.removeEventListener(e, onActivity));
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(timer);
    };
  }, [signedIn]);

  // The name on requests and posts is checked against the saved profile
  // (firestore.rules isMyName), so a renamed member's next request must
  // carry the new name without waiting for a reload.
  const patchUser = (fields: Partial<UserProfile>) => {
    setUser(prev => (prev ? { ...prev, ...fields } : prev));
  };

  return (
    <AuthContext.Provider value={{ user, pendingEmail, loading, logout, patchUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
