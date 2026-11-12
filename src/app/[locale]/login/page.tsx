'use client';

/* Member login: email/password with bot checks (honeypot, minimum fill time,
 * reCAPTCHA, BotID), a growing wait after each failure, a lockout in the
 * browser and a limit on the server, and a choice not to stay signed in on
 * a shared device. Someone whose email address isn't confirmed yet gets the
 * link to confirm it here, and nothing else until they do. */
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  applyActionCode, browserSessionPersistence, indexedDBLocalPersistence, sendEmailVerification, setPersistence,
  signInWithEmailAndPassword, type User,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from '@/i18n/routing';
import PasswordInput from '@/components/PasswordInput';
import { useLocale, useTranslations } from 'next-intl';
import { getRecaptchaToken, preloadRecaptcha } from '@/lib/recaptcha';
import { PASSWORD_FORM_HREF } from '@/lib/passwordForm';
import ThemeLogo from '@/components/ThemeLogo';
import { isTemporaryPassword, MUST_CHANGE_PASSWORD_FLAG } from '@/lib/memberAccounts';
import Honeypot from '@/components/Honeypot';
import { KEEP_KEY, markActive, readKeep, takeSignOutReason, type SignOutReason } from '@/lib/sessionPolicy';
import styles from './Login.module.css';

/* Bot/brute-force deterrents on top of reCAPTCHA and Firebase's own
 * per-account/IP throttling:
 *  - a hidden "website" field people never see; anything that fills it is a bot
 *  - a submission faster than a person can type is refused
 *  - email/password are validated (format, length) before anything is sent
 *  - each failed attempt makes the next one wait: 1, 2, 4, then 8 seconds
 *  - after 5 failed attempts the form locks, 30s doubling up to 15 min
 *    (kept in localStorage so a reload doesn't reset it)
 *  - the server checks the hidden field and the fill time again, slows
 *    down repeated attempts, and allows 10 per account every 15 minutes and
 *    60 per network an hour (api/verify-recaptcha), which clearing storage
 *    can't reset. */
const MAX_FAILS = 5;
const LOCK_BASE_MS = 30_000;
const LOCK_MAX_MS = 15 * 60_000;
const MIN_FILL_MS = 1500;
const LOCK_KEY = 'jh-login-lock';
/** Seconds between "Send the link again" presses. */
const RESEND_WAIT_S = 60;
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

/** When the next attempt may be made after `fails` failures in a row. */
function nextAllowed(fails: number): number {
  if (fails <= 0) return 0;
  if (fails < MAX_FAILS) return Date.now() + 1000 * 2 ** (fails - 1);
  return Date.now() + Math.min(LOCK_BASE_MS * 2 ** (fails - MAX_FAILS), LOCK_MAX_MS);
}

/** The device's remembered choice never changes behind the page's back. */
const noSubscribe = () => () => {};

/** Emails the link that confirms the address, in the page's language: the
 *  hub's own email from jeddahhub.org (api/members/confirm-email), or
 *  Firebase's plainer one when that can't be sent. Too many requests is
 *  passed on as such: Firebase's email must not go around the limit. */
async function sendConfirmLink(u: User, locale: string) {
  const res = await fetch('/api/members/confirm-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await u.getIdToken()}` },
    body: JSON.stringify({ locale }),
  }).catch(() => null);
  if (res?.ok) return;
  if (res?.status === 429) throw Object.assign(new Error('too many requests'), { code: 'auth/too-many-requests' });
  auth.languageCode = locale;
  await sendEmailVerification(u, { url: `${window.location.origin}/${locale}/login` });
}

/** What happened to a confirmation link opened on this page. */
type LinkState = 'checking' | 'confirmed' | 'invalid';

export default function LoginPage() {
  const { user, pendingEmail, loading: authLoading, logout } = useAuth();
  const locale = useLocale();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  // Counted from when the page started opening: on a slow phone the form can
  // be filled long before it becomes interactive, and that isn't a bot.
  const [openedAt] = useState(() => performance.timeOrigin);
  // "Keep me signed in": what this device chose last time, read in the
  // browser only (the server renders it ticked and can't see storage),
  // until the member changes it here.
  const storedKeep = useSyncExternalStore(noSubscribe, readKeep, () => true);
  const [keepChoice, setKeepChoice] = useState<boolean | null>(null);
  const keepSignedIn = keepChoice ?? storedKeep;
  const [capsLock, setCapsLock] = useState(false);
  // Seconds left before the next attempt is allowed (after a failure).
  const [waitLeft, setWaitLeft] = useState(0);
  const [endedReason, setEndedReason] = useState<SignOutReason | null>(null);
  const [confirmNote, setConfirmNote] = useState('');
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const router = useRouter();
  const t = useTranslations('LoginPage');

  // Already signed in: straight to the dashboard instead of a second sign-in.
  // Not while this page is signing someone in: it sends them on itself.
  const signingIn = useRef(false);
  useEffect(() => {
    if (!authLoading && user && !signingIn.current) router.replace('/dashboard');
  }, [authLoading, user, router]);

  // Why the last session ended (idle, too old, ended elsewhere), shown once.
  // Looked at again shortly after: when a session is ended elsewhere,
  // Firebase signs out a moment before the reason is noted.
  useEffect(() => {
    const read = () => { const r = takeSignOutReason(); if (r) setEndedReason(r); };
    read();
    const id = setTimeout(read, 1500);
    return () => clearTimeout(id);
  }, []);

  // A confirmation link from the email opens this page with Firebase's
  // one-time code. Signed in on this browser: straight on to the dashboard.
  // Opened elsewhere (say, on a phone): confirmed, and asked to sign in.
  const [linkState, setLinkState] = useState<LinkState | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('oobCode');
    if (params.get('mode') !== 'verifyEmail' || !code) return;
    // The code works once: keep it out of the address bar and the history.
    window.history.replaceState(null, '', window.location.pathname);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reacting to the link in the address
    setLinkState('checking');
    applyActionCode(auth, code)
      .then(async () => {
        await auth.authStateReady();
        const current = auth.currentUser;
        if (!current) { setLinkState('confirmed'); return; }
        await current.reload().catch(() => {});
        await current.getIdToken(true).catch(() => {});
        window.location.reload();
      })
      .catch(() => setLinkState('invalid'));
  }, []);

  // Counts down the wait after a failed attempt (and a lockout left from before).
  useEffect(() => {
    const tick = () => {
      setNow(Date.now());
      setWaitLeft(Math.max(0, Math.ceil((readLock().until - Date.now()) / 1000)));
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, []);

  /** Opened the link? Then straight in; the token is refreshed so the
   *  database sees the confirmed address. */
  const confirmDone = async () => {
    const current = auth.currentUser;
    if (!current) return;
    setConfirmBusy(true);
    setConfirmNote('');
    try {
      await current.reload();
      if (current.emailVerified) {
        await current.getIdToken(true);
        window.location.reload(); // signed in afresh, confirmed: on to the dashboard
        return;
      }
      setConfirmNote(t('confirmNotYet'));
    } catch {
      setConfirmNote(t('errorNetwork'));
    }
    setConfirmBusy(false);
  };

  const resendLink = async () => {
    const current = auth.currentUser;
    if (!current || Date.now() < resendAt) return;
    setResendAt(Date.now() + RESEND_WAIT_S * 1000);
    setConfirmNote('');
    try {
      await sendConfirmLink(current, locale);
      setConfirmNote(t('confirmSent'));
    } catch (err) {
      setConfirmNote((err as { code?: string } | null)?.code === 'auth/too-many-requests' ? t('errorTooMany') : t('errorGeneral'));
    }
  };

  const onPasswordKey = (e: React.KeyboardEvent<HTMLInputElement>) => setCapsLock(e.getModifierState('CapsLock'));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const lock = readLock();
    if (lock.until > Date.now()) {
      const seconds = Math.ceil((lock.until - Date.now()) / 1000);
      setError(lock.fails >= MAX_FAILS ? t('errorLocked', { seconds }) : t('errorWait', { seconds }));
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
      writeLock({ fails, until: nextAllowed(fails) });
    };

    try {
      const token = await getRecaptchaToken('login');
      const verify = await fetch('/api/verify-recaptcha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // The hidden field and the fill time go too: the server checks them again.
        body: JSON.stringify({ token, action: 'login', email: cleanEmail, website: honeypot, elapsedMs: Date.now() - openedAt }),
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
      markActive();
      // Not confirmed yet: send the link and stay here (the panel below).
      if (!cred.user.emailVerified) {
        signingIn.current = false;
        setPassword('');
        setResendAt(Date.now() + RESEND_WAIT_S * 1000);
        await sendConfirmLink(cred.user, locale).catch(() => setResendAt(0));
        setLoading(false);
        return;
      }
      // Remember (for this tab only) that the temporary password was used,
      // so the dashboard can ask the member to change it.
      try {
        if (isTemporaryPassword(password)) sessionStorage.setItem(MUST_CHANGE_PASSWORD_FLAG, '1');
        else sessionStorage.removeItem(MUST_CHANGE_PASSWORD_FLAG);
      } catch { /* storage blocked */ }
      // Everyone starts on the Overview, which lists what is waiting for
      // them; a one-time password must be replaced first.
      router.push(isTemporaryPassword(password) ? PASSWORD_FORM_HREF : '/dashboard');
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

        {endedReason && !pendingEmail && !linkState && (
          <p className={styles.notice} role="status">{t(`ended_${endedReason}`)}</p>
        )}
        {linkState && <p className={styles.notice} role="status">{t(`link_${linkState}`)}</p>}

        {pendingEmail ? (
          <div className={styles.confirm} role="region" aria-labelledby="confirm-title">
            <h2 id="confirm-title" className={styles.confirmTitle}>{t('confirmTitle')}</h2>
            <p className={styles.confirmText}>{t('confirmText', { email: pendingEmail })}</p>
            {confirmNote && <p className={styles.notice} role="status">{confirmNote}</p>}
            <button type="button" className={'btn-primary ' + styles.submitBtn} onClick={confirmDone} disabled={confirmBusy}>
              {confirmBusy ? <span className={styles.spinner} /> : t('confirmDone')}
            </button>
            <button type="button" className={'btn-ghost ' + styles.confirmBtn} onClick={resendLink} disabled={now < resendAt}>
              {now < resendAt ? t('confirmResendIn', { seconds: Math.ceil((resendAt - now) / 1000) }) : t('confirmResend')}
            </button>
            <button type="button" className={styles.linkBtn} onClick={() => void logout()}>{t('confirmSignOut')}</button>
          </div>
        ) : (<>
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
            <input type="checkbox" checked={keepSignedIn} onChange={e => setKeepChoice(e.target.checked)} />
            <span>
              {t('keepSignedIn')}
              <span className={styles.keepHint}>{t('keepSignedInHint')}</span>
            </span>
          </label>

          <button type="submit" className={'btn-primary ' + styles.submitBtn} disabled={loading || waitLeft > 0}>
            {loading ? <span className={styles.spinner} /> : waitLeft > 0 ? t('waitButton', { seconds: waitLeft }) : t('signIn')}
          </button>
        </form>
        </>)}
      </div>
    </main>
  );
}
