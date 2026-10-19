'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useAuth } from '@/context/AuthContext';
import { signCharter, useCharterStatus } from '@/lib/charterSignature';
import styles from './CharterSign.module.css';

/** The member's sign-off at the end of the Charter, matching the hub's
 *  Google Form: their name plus "I confirm compliance with Community
 *  Charter". Shown whether or not curators currently require it. */
export default function CharterSignOff() {
  const t = useTranslations('CharterPage');
  const locale = useLocale();
  const { user } = useAuth();
  const { loading, required, signature } = useCharterStatus(user?.uid);
  const [name, setName] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!user || loading) return null;

  const fullName = name || user.displayName || '';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !confirmed) return;
    setSaving(true); setError('');
    try {
      await signCharter(user.uid, fullName);
    } catch {
      setError(t('signFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section id="sign" className={styles.signCard + (signature ? ' ' + styles.signCardDone : required ? ' ' + styles.signCardRequired : '')}>
      {signature ? (
        <div className={styles.signedRow}>
          <span className={styles.signedIcon} aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6 9 17l-5-5" /></svg>
          </span>
          <div>
            <h2 className={styles.signTitle}>{t('signedTitle')}</h2>
            <p className={styles.signText}>
              {t('signedOn', {
                name: signature.name,
                date: new Date(signature.signedAt).toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
              })}
            </p>
          </div>
        </div>
      ) : (
        <form onSubmit={submit}>
          <h2 className={styles.signTitle}>{t('signTitle')}</h2>
          <p className={styles.signText}>{required ? t('signRequiredIntro') : t('signIntro')}</p>
          <label className={styles.fieldLabel} htmlFor="charter-name">{t('signName')}</label>
          <input
            id="charter-name"
            className={styles.input}
            value={fullName}
            onChange={e => setName(e.target.value)}
            maxLength={120}
            required
            autoComplete="name"
          />
          <label className={styles.confirmRow}>
            <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} required />
            {/* Exact wording of the hub's Google Form question. */}
            <span lang="en">I confirm compliance with Community Charter</span>
          </label>
          {error && <p className={styles.error}>{error}</p>}
          <button type="submit" className={styles.signBtn} disabled={saving || !confirmed || !fullName.trim()}>
            {saving ? t('signing') : t('signSubmit')}
          </button>
        </form>
      )}
    </section>
  );
}
