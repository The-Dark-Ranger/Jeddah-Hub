'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import styles from './NewsletterForm.module.css';

export default function NewsletterForm() {
  const t = useTranslations('HomePage');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setStatus('loading');
    try {
      await addDoc(collection(db, 'newsletter_subscribers'), {
        email,
        subscribedAt: new Date().toISOString()
      });
      setStatus('success');
      setEmail('');
    } catch (error) {
      console.error("Error subscribing to newsletter:", error);
      setStatus('error');
    }
  };

  return (
    <div className={styles.newsletterContainer}>
      <h3 className={styles.title}>{t('newsletter')}</h3>
      <form onSubmit={handleSubmit} className={styles.form}>
        <input 
          type="email" 
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your.email@example.com" 
          className={styles.input}
          required
        />
        <button type="submit" className={styles.button} disabled={status === 'loading'}>
          {status === 'loading' ? '...' : t('subscribe')}
        </button>
      </form>
      {status === 'success' && <p className={styles.successMessage}>{t('newsletterSuccess')}</p>}
      {status === 'error' && <p className={styles.errorMessage}>{t('newsletterError')}</p>}
    </div>
  );
}
