'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getRecaptchaToken } from '@/lib/recaptcha';
import { isValidEmail } from '@/lib/validateEmail';
import styles from './Contact.module.css';
import WaveDivider from '@/components/WaveDivider';

export default function ContactPage() {
  const t = useTranslations('ContactPage');
  const [formData, setFormData] = useState({ name: '', email: '', subject: '', message: '' });
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error' | 'invalid-email'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidEmail(formData.email)) { setStatus('invalid-email'); return; }
    setStatus('loading');
    try {
      // Check the domain can actually receive mail — a curator replies to
      // this address later, so a fake domain would just bounce silently.
      const emailCheck = await fetch('/api/validate-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.email }),
      }).then(r => r.json()).catch(() => ({ ok: true })); // network hiccup shouldn't block a real submission
      if (!emailCheck.ok) { setStatus('invalid-email'); return; }

      const token = await getRecaptchaToken('contact');
      const verify = await fetch('/api/verify-recaptcha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      if (!verify.ok) { setStatus('error'); return; }

      await addDoc(collection(db, 'contact_messages'), {
        ...formData,
        submittedAt: new Date().toISOString(),
        read: false,
      });
      setStatus('success');
      setFormData({ name: '', email: '', subject: '', message: '' });
    } catch (err) {
      console.error(err);
      setStatus('error');
    }
  };

  return (
    <main className={styles.page}>
      <div className={styles.hero}>
        <div className={styles.heroInner}>
          <p className={styles.eyebrow}>{t('heroEyebrow')}</p>
          <h1 className={styles.title}>{t('title')}</h1>
          <p className={styles.subtitle}>{t('subtitle')}</p>
        </div>
        <WaveDivider fill="var(--background)" className={styles.heroWave} />
      </div>


      <div className={styles.body}>
        <div className={styles.grid}>

          {/* Form column */}
          <div className={styles.formCard}>
            {status === 'success' ? (
              <div className={styles.successState}>
                <div className={styles.successIcon}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="9 12 11 14 15 10" />
                  </svg>
                </div>
                <h2 className={styles.successTitle}>{t('success')}</h2>
                <p className={styles.successDetail}>{t('successDetail')}</p>
                <button className={styles.resetBtn} onClick={() => setStatus('idle')}>
                  {t('sendAnother')}
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className={styles.form}>
                <div className={styles.formCardHeader}>
                  <span className={styles.formCardIcon}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="4" width="20" height="16" rx="2" />
                      <polyline points="2,4 12,13 22,4" />
                    </svg>
                  </span>
                  <h2 className={styles.formCardTitle}>{t('formTitle')}</h2>
                </div>

                <div className={styles.formRow}>
                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="name">{t('name')}<span className={styles.required}>*</span></label>
                    <input
                      id="name"
                      className={styles.input}
                      type="text"
                      required
                      placeholder={t('namePlaceholder')}
                      value={formData.name}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="email">{t('email')}<span className={styles.required}>*</span></label>
                    <input
                      id="email"
                      className={styles.input}
                      type="email"
                      required
                      placeholder={t('emailPlaceholder')}
                      value={formData.email}
                      onChange={e => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                </div>

                <div className={styles.field}>
                  <label className={styles.label} htmlFor="subject">{t('subject')}<span className={styles.required}>*</span></label>
                  <select
                    id="subject"
                    className={styles.select}
                    required
                    value={formData.subject}
                    onChange={e => setFormData({ ...formData, subject: e.target.value })}
                  >
                    <option value="" disabled>{t('subject')}</option>
                    <option value="general">{t('subjectGeneral')}</option>
                    <option value="partnership">{t('subjectPartnership')}</option>
                    <option value="join">{t('subjectJoin')}</option>
                    <option value="media">{t('subjectMedia')}</option>
                    <option value="other">{t('subjectOther')}</option>
                  </select>
                </div>

                <div className={styles.field}>
                  <label className={styles.label} htmlFor="message">{t('message')}<span className={styles.required}>*</span></label>
                  <textarea
                    id="message"
                    className={styles.textarea}
                    required
                    placeholder={t('messagePlaceholder')}
                    value={formData.message}
                    onChange={e => setFormData({ ...formData, message: e.target.value })}
                  />
                </div>

                <button type="submit" className={styles.submitBtn} disabled={status === 'loading'}>
                  {status === 'loading' ? (
                    <span className={styles.spinner} aria-hidden="true" />
                  ) : null}
                  {status === 'loading' ? '' : t('submit')}
                </button>

                {status === 'invalid-email' && (
                  <p className={styles.errorMsg}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                    {t('invalidEmail')}
                  </p>
                )}

                {status === 'error' && (
                  <p className={styles.errorMsg}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                    {t('error')}
                  </p>
                )}
              </form>
            )}
          </div>

          {/* Sidebar */}
          <aside className={styles.sidebar}>
            <div className={styles.sidebarCard}>
              <h2 className={styles.sidebarTitle}>{t('orEmail')}</h2>
              <div className={styles.contactItems}>
                <a href={`mailto:${t('contactEmail')}`} className={styles.contactItem}>
                  <span className={styles.contactIcon}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="4" width="20" height="16" rx="2" />
                      <polyline points="2,4 12,13 22,4" />
                    </svg>
                  </span>
                  <span className={styles.contactText}>{t('contactEmail')}</span>
                </a>

                <div className={styles.contactItem}>
                  <span className={styles.contactIcon}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                  </span>
                  <span className={styles.contactText}>{t('location')}</span>
                </div>
              </div>
            </div>

            <div className={styles.sidebarCard}>
              <h2 className={styles.sidebarTitle}>{t('followUs')}</h2>
              <div className={styles.socialRow}>
                <a href="https://www.linkedin.com/company/global-shapers-jeddah-hub" target="_blank" rel="noopener noreferrer" className={styles.socialIcon} aria-label="LinkedIn">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                  </svg>
                </a>
                <a href="https://x.com/JeddahHub" target="_blank" rel="noopener noreferrer" className={styles.socialIcon} aria-label="X / Twitter">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                  </svg>
                </a>
                <a href="https://www.instagram.com/jeddahhub" target="_blank" rel="noopener noreferrer" className={styles.socialIcon} aria-label="Instagram">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                  </svg>
                </a>
              </div>
            </div>

            <div className={styles.responseNote}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              {t('responseTime')}
            </div>
          </aside>

        </div>
      </div>
    </main>
  );
}
