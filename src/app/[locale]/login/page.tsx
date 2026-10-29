'use client';

/* Member login: email/password with bot checks (honeypot, minimum fill time,
 * reCAPTCHA) and a lockout after repeated failures, plus "Forgot password?",
 * which emails a link to set a new password. */
import { useState } from 'react';
import { sendPasswordResetEmail, signInWithEmailAndPassword, type UserCredential } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { getUserProfile } from '@/lib/auth';
import { useRouter } from '@/i18n/routing';
import PasswordInput from '@/components/PasswordInput';
import { useLocale, useTranslations } from 'next-intl';
import { getRecaptchaToken, preloadRecaptcha } from '@/lib/recaptcha';
import ThemeLogo from '@/components/ThemeLogo';
import { normalizeRole } from '@/lib/role';
import { isTemporaryPassword, MUST_CHANGE_PASSWORD_FLAG } from '@/lib/memberAccounts';
import { errorCode } from '@/lib/types';
import Honeypot from '@/components/Honeypot';
import styles from './Login.module.css';

/* Bot/brute-force deterrents on top of reCAPTCHA and Firebase's own
 * per-account/IP throttling:
 *  - a hidden "website" field people never see; anything that fills it is a bot
 *  - a submission faster than a person can type is refused
 *  - email/password are validated (format, length) before anything is sent
 *  - after 5 failed attempts the form locks, 30s doubling up to 15 min
 *    (kept in localStorage so a reload doesn't reset it). */
const MAX_FAILS = 5;
const LOCK_BASE_MS = 30_000;
const LOCK_MAX_MS = 15 * 60_000;
const MIN_FILL_MS = 1500;
const LOCK_KEY = 'jh-login-lock';
/** One reset email a minute from this browser (Firebase also limits them). */
const RESET_KEY = 'jh-reset-wait';
const RESET_WAIT_MS = 60_000;
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
function recordFailure() {
  const fails = readLock().fails + 1;
  const until = fails >= MAX_FAILS ? Date.now() + Math.min(LOCK_BASE_MS * 2 ** (fails - MAX_FAILS), LOCK_MAX_MS) : 0;
  writeLock({ fails, until });
}
function resetWaitUntil(): number {
  try { return Number(localStorage.getItem(RESET_KEY)) || 0; } catch { return 0; }
}

export default function LoginPage() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [openedAt] = useState(() => Date.now());
  // Forgot password.
  const [resetOpen, setResetOpen]   = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetState, setResetState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [resetError, setResetError] = useState('');
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('LoginPage');

  /** After a successful sign-in: clear the lockout, remember (for this tab)
   *  whether a temporary password was used, and open the right dashboard. */
  const finishSignIn = async (cred: UserCredential, temporary: boolean) => {
    writeLock({ fails: 0, until: 0 });
    try {
      if (temporary) sessionStorage.setItem(MUST_CHANGE_PASSWORD_FLAG, '1');
      else sessionStorage.removeItem(MUST_CHANGE_PASSWORD_FLAG);
    } catch { /* storage blocked */ }
    const profile = await getUserProfile(cred.user.uid);

    const normRole = normalizeRole(profile?.role);
    if (normRole === 'curator' || normRole === 'vice_curator') {
      router.push('/dashboard/curator/initiatives');
    } else if (normRole === 'impact_officer') {
      router.push('/dashboard/impact/projects');
    } else if (normRole === 'shaper' || normRole === 'alumni') {
      router.push('/dashboard/shaper/profile');
    } else {
      router.push('/dashboard');
    }
  };

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
    try {
      const token = await getRecaptchaToken('login');
      const verify = await fetch('/api/verify-recaptcha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, action: 'login' }),
      });
      if (!verify.ok) {
        setError(t('errorGeneral'));
        setLoading(false);
        return;
      }

      await finishSignIn(await signInWithEmailAndPassword(auth, cleanEmail, password), isTemporaryPassword(password));
    } catch (err) {
      const code = errorCode(err);
      if (code === 'auth/user-not-found' || code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/invalid-email') {
        recordFailure();
        setError(t('errorInvalid'));
      } else if (code === 'auth/password-does-not-meet-requirements') {
        // An older, too-short password: it has to be replaced by email link.
        setError(t('errorPasswordRenew'));
        setResetEmail(cleanEmail);
        setResetOpen(true);
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

  /** Emails a link to set a new password. The reply is the same whether or
   *  not the address has an account, so the form can't reveal who is a member. */
  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError('');
    const target = resetEmail.trim().toLowerCase();
    if (target.length > 254 || !EMAIL_RE.test(target)) { setResetError(t('errorEmailFormat')); return; }
    const wait = resetWaitUntil() - Date.now();
    if (wait > 0) { setResetError(t('resetWait', { seconds: Math.ceil(wait / 1000) })); return; }

    setResetState('sending');
    try {
      const token = await getRecaptchaToken('reset');
      const verify = await fetch('/api/verify-recaptcha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, action: 'reset' }),
      });
      if (!verify.ok) { setResetError(t('errorGeneral')); setResetState('idle'); return; }

      auth.languageCode = locale; // the email in the page's language
      try {
        await sendPasswordResetEmail(auth, target, { url: `${window.location.origin}/${locale}/login` });
      } catch (err) {
        // A preview address that isn't an authorised domain: send the link
        // without the "back to the site" button rather than not at all.
        if (!/continue-uri/.test(errorCode(err))) throw err;
        await sendPasswordResetEmail(auth, target);
      }
      try { localStorage.setItem(RESET_KEY, String(Date.now() + RESET_WAIT_MS)); } catch { /* storage blocked */ }
      setResetState('sent');
    } catch (err) {
      const c = errorCode(err);
      setResetError(c === 'auth/too-many-requests' ? t('errorTooMany') : c === 'auth/network-request-failed' ? t('errorNetwork') : t('errorGeneral'));
      setResetState('idle');
    }
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
          <div className={styles.errorBox} role="alert">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
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
            />
          </div>

          <button type="submit" className={'btn-primary ' + styles.submitBtn} disabled={loading}>
            {loading ? <span className={styles.spinner} /> : t('signIn')}
          </button>
        </form>

        <div className={styles.reset}>
          <button
            type="button"
            className={styles.linkBtn}
            aria-expanded={resetOpen}
            aria-controls="login-reset"
            onClick={() => { setResetOpen(o => !o); setResetEmail(v => v || email.trim()); }}
          >
            {t('forgotPassword')}
          </button>
          {resetOpen && (
            <form id="login-reset" className={styles.resetForm} onSubmit={handleReset} onFocus={preloadRecaptcha}>
              {resetState === 'sent' ? (
                <p className={styles.notice} role="status">{t('resetSent', { email: resetEmail.trim().toLowerCase() })}</p>
              ) : (<>
                <p className={styles.hint}>{t('resetIntro')}</p>
                <label className="form-label" htmlFor="login-reset-email">{t('email')}</label>
                <input
                  id="login-reset-email"
                  type="email"
                  className="form-input"
                  value={resetEmail}
                  onChange={e => setResetEmail(e.target.value)}
                  placeholder={t('emailPlaceholder')}
                  required
                  maxLength={254}
                  autoComplete="email"
                />
                {resetError && <p className={styles.resetError} role="alert">{resetError}</p>}
                <button type="submit" className={styles.secondaryBtn} disabled={resetState === 'sending'}>
                  {resetState === 'sending' ? t('resetSending') : t('resetSend')}
                </button>
              </>)}
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
