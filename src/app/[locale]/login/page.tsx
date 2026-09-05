'use client';

import { useState, useEffect } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { getUserProfile } from '@/lib/auth';
import { useRouter } from '@/i18n/routing';
import { useTranslations } from 'next-intl';
import { getRecaptchaToken } from '@/lib/recaptcha';
import { useTheme } from '@/context/ThemeContext';
import { normalizeRole } from '@/lib/role';
import styles from './Login.module.css';

export default function LoginPage() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const router = useRouter();
  const t = useTranslations('LoginPage');
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const token = await getRecaptchaToken('login');
      const verify = await fetch('/api/verify-recaptcha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      if (!verify.ok) {
        setError(t('errorGeneral'));
        setLoading(false);
        return;
      }

      const cred    = await signInWithEmailAndPassword(auth, email, password);
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
    } catch (err: any) {
      const code = err.code || '';
      if (code === 'auth/user-not-found' || code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/invalid-email') {
        setError(t('errorInvalid'));
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
          <img
            src={mounted && theme === 'dark' ? '/logo-dark.png' : '/logo.png'}
            alt="Jeddah Hub"
            className={styles.logo}
            onError={e => { (e.currentTarget as HTMLImageElement).src = '/logo.png'; }}
          />
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

        <form onSubmit={handleSubmit} className={styles.form}>
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
              autoComplete="email"
            />
          </div>

          <div className={styles.field}>
            <label className="form-label" htmlFor="login-password">{t('password')}</label>
            <input
              id="login-password"
              type="password"
              className="form-input"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              autoComplete="current-password"
            />
          </div>

          <button type="submit" className={'btn-primary ' + styles.submitBtn} disabled={loading}>
            {loading ? <span className={styles.spinner} /> : t('signIn')}
          </button>
        </form>
      </div>
    </main>
  );
}
