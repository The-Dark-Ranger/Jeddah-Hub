'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import styles from './Contact.module.css';

export default function ContactPage() {
  const t = useTranslations('ContactPage');
  const [formData, setFormData] = useState({ name: '', email: '', subject: '', message: '' });
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    try {
      await addDoc(collection(db, 'contact_messages'), {
        ...formData,
        submittedAt: new Date().toISOString(),
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
                  Send another message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className={styles.form}>
                <div className={styles.formRow}>
                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="name">{t('name')}</label>
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
                    <label className={styles.label} htmlFor="email">{t('email')}</label>
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
                  <label className={styles.label} htmlFor="subject">{t('subject')}</label>
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
                  <label className={styles.label} htmlFor="message">{t('message')}</label>
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

                {status === 'error' && (
                  <p className={styles.errorMsg}>{t('error')}</p>
                )}
              </form>
            )}
          </div>

          {/* Sidebar */}
          <aside className={styles.sidebar}>
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

              <a href="https://instagram.com/jeddahhub" target="_blank" rel="noopener noreferrer" className={styles.contactItem}>
                <span className={styles.contactIcon}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="2" width="20" height="20" rx="5" />
                    <circle cx="12" cy="12" r="4" />
                    <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
                  </svg>
                </span>
                <span className={styles.contactText}>{t('contactInstagram')}</span>
              </a>

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
