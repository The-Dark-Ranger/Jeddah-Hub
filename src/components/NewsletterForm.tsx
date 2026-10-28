'use client';

/* Newsletter signup. Everything (bot checks, saving each address once and
 * the welcome email) happens in /api/newsletter/subscribe; this form only
 * collects the address and shows the outcome. */
import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { getRecaptchaToken, preloadRecaptcha } from '@/lib/recaptcha';
import { isValidEmail } from '@/lib/validateEmail';
import Honeypot from '@/components/Honeypot';
import styles from './NewsletterForm.module.css';

/** How long the confirmation stays up before the form resets itself, so a
 *  second visitor on the same device isn't stuck behind a stale success
 *  message with no way to subscribe another address. */
const SUCCESS_RESET_MS = 6000;

type Status = 'idle' | 'loading' | 'success' | 'already' | 'error' | 'invalid-email' | 'too-many';

export default function NewsletterForm() {
  const t = useTranslations('HomePage');
  const locale = useLocale();
  const [email, setEmail] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [openedAt] = useState(() => Date.now());
  const [status, setStatus] = useState<Status>('idle');

  useEffect(() => {
    if (status !== 'success' && status !== 'already') return;
    const timer = setTimeout(() => setStatus('idle'), SUCCESS_RESET_MS);
    return () => clearTimeout(timer);
  }, [status]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidEmail(email.trim())) { setStatus('invalid-email'); return; }

    setStatus('loading');
    try {
      const recaptchaToken = await getRecaptchaToken('newsletter_subscribe');
      const res = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), recaptchaToken, locale, website: honeypot, elapsedMs: Date.now() - openedAt }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setStatus(data.status === 'already' ? 'already' : 'success');
        setEmail('');
      } else {
        setStatus(data.error === 'invalid_email' ? 'invalid-email' : res.status === 429 ? 'too-many' : 'error');
      }
    } catch {
      setStatus('error');
    }
  };

  return (
    <div className={styles.newsletterContainer}>
      <h3 className={styles.title}>{t('newsletter')}</h3>
      <p className={styles.subtitle}>{t('newsletterSubtitle')}</p>
      <form onSubmit={handleSubmit} onFocus={preloadRecaptcha} className={styles.form}>
        <Honeypot id="newsletter-website" value={honeypot} onChange={setHoneypot} />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your.email@example.com"
          className={styles.input}
          maxLength={254}
          autoComplete="email"
          required
          disabled={status === 'loading'}
        />
        <button type="submit" className={styles.button} disabled={status === 'loading'}>
          {status === 'loading' ? t('newsletterSubscribing') : t('subscribe')}
        </button>
      </form>
      {(status === 'success' || status === 'already') && (
        <div className={styles.successBox} role="status">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}>
            <circle cx="12" cy="12" r="10"/><polyline points="9 12 11 14 15 10"/>
          </svg>
          <div>
            <p className={styles.successTitle}>{t(status === 'already' ? 'newsletterAlreadyTitle' : 'newsletterSuccessTitle')}</p>
            <p className={styles.successDetail}>{t(status === 'already' ? 'newsletterAlreadyDetail' : 'newsletterSuccessDetail')}</p>
          </div>
        </div>
      )}
      {status === 'invalid-email' && <p className={styles.errorMessage}>{t('newsletterInvalidEmail')}</p>}
      {status === 'too-many' && <p className={styles.errorMessage}>{t('newsletterTooMany')}</p>}
      {status === 'error' && <p className={styles.errorMessage}>{t('newsletterError')}</p>}
    </div>
  );
}
