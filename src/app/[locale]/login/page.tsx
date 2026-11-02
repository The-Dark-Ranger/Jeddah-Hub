'use client';

/* Member login: email/password with bot checks (honeypot, minimum fill time,
 * reCAPTCHA, BotID), a lockout after repeated failures in the browser and a
 * limit on the server, and a choice not to stay signed in on a shared device. */
import { useEffect, useRef, useState } from 'react';
import {
  browserSessionPersistence, indexedDBLocalPersistence, setPersistence, signInWithEmailAndPassword,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { getUserProfile } from '@/lib/auth';
import { useRouter } from '@/i18n/routing';
import PasswordInput from '@/components/PasswordInput';
import { useTranslations } from 'next-intl';
import { getRecaptchaToken, preloadRecaptcha } from '@/lib/recaptcha';
import { PASSWORD_FORM_HREF } from '@/lib/passwordForm';
import ThemeLogo from '@/components/ThemeLogo';
import { normalizeRole } from '@/lib/role';
import { isTemporaryPassword, MUST_CHANGE_PASSWORD_FLAG } from '@/lib/memberAccounts';
import Honeypot from '@/components/Honeypot';
import styles from './Login.module.css';

/* Bot/brute-force deterrents on top of reCAPTCHA and Firebase's own
 * per-account/IP throttling:
 *  - a hidden "website" field people never see; anything that fills it is a bot
 *  - a submission faster than a person can type is refused
 *  - email/password are validated (format, length) before anything is sent
 *  - after 5 failed attempts the form locks, 30s doubling up to 15 min
 *    (kept in localStorage so a reload doesn't reset it)
 *  - the server allows 10 attempts per account every 15 minutes and 60 per
 *    network an hour (api/verify-recaptcha), which clearing storage can't reset. */
const MAX_FAILS = 5;
const LOCK_BASE_MS = 30_000;
const LOCK_MAX_MS = 15 * 60_000;
const MIN_FILL_MS = 1500;
const LOCK_KEY = 'jh-login-lock';
/** The "Keep me signed in" choice, remembered on this device (not a secret). */
const KEEP_KEY = 'jh-keep-signed-in';
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,63}$/;

type LockState = { fails: number; until: number };
function readLock(): LockState {
  try {
    const v = JSON.parse(localStorage.getItem(LOCK_KEY) || '{}');
    return { fails: Number(v.fails) || 0, until: Number(v.until) || 0 };
  } catch { return { fails: 0, until: 0 }; }
}
function writeLock(s: LockState) {
  try { localStorage.setItem(LOCK_KEY, JSON.stringify(s)); } catch { /* storage blocked */ }
}

function readKeep(): boolean {
  try { return localStorage.getItem(KEEP_KEY) !== '0'; } catch { return true; }
}

export default function LoginPage() {
  const { user, loading: authLoading } = useAuth();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  // Counted from when the page started opening: on a slow phone the form can
  // be filled long before it becomes interactive, and that isn't a bot.
  const [openedAt] = useState(() => performance.timeOrigin);
  const [keepSignedIn, setKeepSignedIn] = useState(readKeep);
  const [capsLock, setCapsLock] = useState(false);
  const router = useRouter();
  const t = useTranslations('LoginPage');

  // Already signed in: straight to the dashboard instead of a second sign-in.
  // Not while this page is signing someone in: it sends them on itself.
  const signingIn = useRef(false);
  useEffect(() => {
    if (!authLoading && user && !signingIn.current) router.replace('/dashboard');
  }, [authLoading, user, router]);

  const onPasswordKey = (e: React.KeyboardEvent<HTMLInputElement>) => setCapsLock(e.getModifierState('CapsLock'));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const lock = readLock();
    if (lock.until > Date.now()) {
      setError(t('errorLocked', { seconds: Math.ceil((lock.until - Date.now()) / 1000) }));
      return;
    }
    const cleanEmail = email.trim().toLowerCase();
    // A filled honeypot or an instant submit: fail quietly, like a wrong password.
    if (honeypot || Date.now() - openedAt < MIN_FILL_MS) {
      setError(t('errorInvalid'));
      return;
    }
    if (cleanEmail.length > 254 || !EMAIL_RE.test(cleanEmail)) {
      setError(t('errorEmailFormat'));
      return;
    }
    if (password.length < 6 || password.length > 128) {
      setError(t('errorInvalid'));
      return;
    }

    setLoading(true);
    const recordFailure = () => {
      const fails = readLock().fails + 1;
      const until = fails >= MAX_FAILS ? Date.now() + Math.min(LOCK_BASE_MS * 2 ** (fails - MAX_FAILS), LOCK_MAX_MS) : 0;
      writeLock({ fails, until });
    };

    try {
      const token = await getRecaptchaToken('login');
      const verify = await fetch('/api/verify-recaptcha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, action: 'login', email: cleanEmail }),
      });
      if (!verify.ok) {
        setError(verify.status === 429 ? t('errorTooMany') : t('errorGeneral'));
        setLoading(false);
        return;
      }

      // On a shared computer the session ends when the browser closes.
      try { localStorage.setItem(KEEP_KEY, keepSignedIn ? '1' : '0'); } catch { /* storage blocked */ }
      await setPersistence(auth, keepSignedIn ? indexedDBLocalPersistence : browserSessionPersistence)
        .catch(() => setPersistence(auth, browserSessionPersistence))
        .catch(() => { /* keep the default */ });
      signingIn.current = true;
      const cred    = await signInWithEmailAndPassword(auth, cleanEmail, password);
      writeLock({ fails: 0, until: 0 });
      // Remember (for this tab only) that the temporary password was used,
      // so the dashboard can ask the member to change it.
      try {
        if (isTemporaryPassword(password)) sessionStorage.setItem(MUST_CHANGE_PASSWORD_FLAG, '1');
        else sessionStorage.removeItem(MUST_CHANGE_PASSWORD_FLAG);
      } catch { /* storage blocked */ }
      const profile = await getUserProfile(cred.user.uid);

      const normRole = normalizeRole(profile?.role);
      if (isTemporaryPassword(password)) {
        router.push(PASSWORD_FORM_HREF);
      } else if (normRole === 'curator' || normRole === 'vice_curator') {
        router.push('/dashboard/curator/initiatives');
      } else if (normRole === 'impact_officer') {
        router.push('/dashboard/impact/projects');
      } else if (normRole === 'shaper' || normRole === 'alumni') {
        router.push('/dashboard/shaper/profile');
      } else {
        router.push('/dashboard');
      }
    } catch (err) {
      signingIn.current = false;
      // A failed password doesn't stay on screen.
      setPassword('');
      const code = (err as { code?: string } | null)?.code ?? '';
      // A disabled account answers like a wrong password, so the page never
      // tells anyone which addresses have an account.
      if (code === 'auth/user-not-found' || code === 'auth/invalid-credential' || code === 'auth/wrong-password'
          || code === 'auth/invalid-email' || code === 'auth/user-disabled') {
        recordFailure();
        setError(t('errorInvalid'));
      } else if (code === 'auth/password-does-not-meet-requirements') {
        // An older, too-short password: a curator sends a new one.
        setError(t('errorPasswordRenew'));
      } else if (code === 'auth/too-many-requests') {
        setError(t('errorTooMany'));
      } else if (code === 'auth/network-request-failed') {
        setError(t('errorNetwork'));
      } else {
        setError(t('errorGeneral'));
      }
    }
    setLoading(false);
  };

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <div className={styles.header}>
          <ThemeLogo className={styles.logo} priority />
          <h1 className={styles.title}>{t('title')}</h1>
          <p className={styles.subtitle}>{t('subtitle')}</p>
        </div>

        {error && (
          <div className={styles.errorBox}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="15" y1="9" x2="9" y2="15"/>
              <line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} onFocus={preloadRecaptcha} className={styles.form}>
          <Honeypot id="login-website" value={honeypot} onChange={setHoneypot} />
          <div className={styles.field}>
            <label className="form-label" htmlFor="login-email">{t('email')}</label>
            <input
              id="login-email"
              type="email"
              className="form-input"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder={t('emailPlaceholder')}
              required
              maxLength={254}
              autoComplete="email"
            />
          </div>

          <div className={styles.field}>
            <label className="form-label" htmlFor="login-password">{t('password')}</label>
            <PasswordInput
              id="login-password"
              className="form-input"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              maxLength={128}
              autoComplete="current-password"
              onKeyDown={onPasswordKey}
              onKeyUp={onPasswordKey}
              aria-describedby={capsLock ? 'login-caps' : undefined}
            />
            {capsLock && <p id="login-caps" className={styles.capsNote} role="status">{t('capsLockOn')}</p>}
          </div>

          <label className={styles.keepRow}>
            <input type="checkbox" checked={keepSignedIn} onChange={e => setKeepSignedIn(e.target.checked)} />
            <span>
              {t('keepSignedIn')}
              <span className={styles.keepHint}>{t('keepSignedInHint')}</span>
            </span>
          </label>

          <button type="submit" className={'btn-primary ' + styles.submitBtn} disabled={loading}>
            {loading ? <span className={styles.spinner} /> : t('signIn')}
          </button>
        </form>
      </div>
    </main>
  );
}
