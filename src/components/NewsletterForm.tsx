'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import styles from './NewsletterForm.module.css';

/** How long the confirmation stays up before the form resets itself, so a
 *  second visitor on the same device isn't stuck behind a stale success
 *  message with no way to subscribe another address. */
const SUCCESS_RESET_MS = 6000;

export default function NewsletterForm() {
  const t = useTranslations('HomePage');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  useEffect(() => {
    if (status !== 'success') return;
    const timer = setTimeout(() => setStatus('idle'), SUCCESS_RESET_MS);
    return () => clearTimeout(timer);
  }, [status]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setStatus('loading');
    try {
      await addDoc(collection(db, 'newsletter_subscribers'), {
        email: email.toLowerCase().trim(),
        subscribedAt: new Date().toISOString(),
      });

      fetch('/api/newsletter/welcome', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      }).catch(() => {});

      setStatus('success');
      setEmail('');
    } catch {
      setStatus('error');
    }
  };

  return (
    <div className={styles.newsletterContainer}>
      <h3 className={styles.title}>{t('newsletter')}</h3>
      <p className={styles.subtitle}>{t('newsletterSubtitle')}</p>
      <form onSubmit={handleSubmit} className={styles.form}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your.email@example.com"
          className={styles.input}
          required
          disabled={status === 'loading'}
        />
        <button type="submit" className={styles.button} disabled={status === 'loading'}>
          {status === 'loading' ? t('newsletterSubscribing') : t('subscribe')}
        </button>
      </form>
      {status === 'success' && (
        <div className={styles.successBox} role="status">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}>
            <circle cx="12" cy="12" r="10"/><polyline points="9 12 11 14 15 10"/>
          </svg>
          <div>
            <p className={styles.successTitle}>{t('newsletterSuccessTitle')}</p>
            <p className={styles.successDetail}>{t('newsletterSuccessDetail')}</p>
          </div>
        </div>
      )}
      {status === 'error' && <p className={styles.errorMessage}>{t('newsletterError')}</p>}
    </div>
  );
}
