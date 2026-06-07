'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { collection, addDoc, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import styles from './NewsletterForm.module.css';

export default function NewsletterForm() {
  const t = useTranslations('HomePage');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error' | 'duplicate'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setStatus('loading');
    try {
      const existing = await getDocs(
        query(collection(db, 'newsletter_subscribers'), where('email', '==', email.toLowerCase().trim()))
      );
      if (!existing.empty) { setStatus('duplicate'); return; }

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
      <p className={styles.subtitle}>Get updates on our latest initiatives, stories, and events — straight to your inbox.</p>
      <form onSubmit={handleSubmit} className={styles.form}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your.email@example.com"
          className={styles.input}
          required
          disabled={status === 'loading' || status === 'success'}
        />
        <button type="submit" className={styles.button} disabled={status === 'loading' || status === 'success'}>
          {status === 'loading' ? '...' : status === 'success' ? '✓ Subscribed' : t('subscribe')}
        </button>
      </form>
      {status === 'success' && (
        <div className={styles.successBox}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}>
            <circle cx="12" cy="12" r="10"/><polyline points="9 12 11 14 15 10"/>
          </svg>
          <div>
            <p className={styles.successTitle}>You&apos;re in! Welcome to Jeddah Hub.</p>
            <p className={styles.successDetail}>Check your inbox for a welcome email with everything you need to know. We&apos;ll keep you posted on new initiatives, stories, and events.</p>
          </div>
        </div>
      )}
      {status === 'duplicate' && (
        <p className={styles.infoMessage}>This email is already subscribed. We&apos;ll keep the updates coming!</p>
      )}
      {status === 'error' && <p className={styles.errorMessage}>{t('newsletterError')}</p>}
    </div>
  );
}
