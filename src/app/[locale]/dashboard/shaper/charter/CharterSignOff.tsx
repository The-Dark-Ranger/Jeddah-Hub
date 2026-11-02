'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useAuth } from '@/context/AuthContext';
import { Link } from '@/i18n/routing';
import { matchAccountName, signCharter, useCharterStatus } from '@/lib/charterSignature';
import { downloadCharterPdf } from './charterPdf';
import styles from './CharterSign.module.css';
import { intlLocale } from '@/lib/dates';

/** The member's sign-off at the end of the Charter: they type the name on
 *  their account (a different name is cleared and has to be typed again) and
 *  tick one box saying they have read the Charter and will adhere to it.
 *  Shown whether or not curators currently require it. */
export default function CharterSignOff() {
  const t = useTranslations('CharterPage');
  const locale = useLocale();
  const { user } = useAuth();
  const { loading, required, signature } = useCharterStatus(user?.uid);
  const [name, setName] = useState('');
  const [nameRejected, setNameRejected] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const nameInput = useRef<HTMLInputElement>(null);

  // The dashboard's "sign the Charter" link ends in #sign, but this card only
  // appears once the status has loaded, too late for the browser's own jump.
  useEffect(() => {
    if (!loading && window.location.hash === '#sign') {
      document.getElementById('sign')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [loading]);

  if (!user || loading) return null;

  const accountNames = [user.displayName, user.displayNameAr].filter((n): n is string => !!n?.trim());
  const shownNames = accountNames.join(' / ');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmed || saving) return;
    const accountName = matchAccountName(name, accountNames);
    if (!accountName) {
      setName('');
      setNameRejected(true);
      nameInput.current?.focus();
      return;
    }
    setNameRejected(false);
    setSaving(true); setError('');
    try {
      await signCharter(user.uid, accountName);
    } catch {
      setError(t('signFailed'));
    } finally {
      setSaving(false);
    }
  };

  const downloadSignedCopy = async () => {
    if (!signature) return;
    setDownloading(true); setError('');
    try {
      await downloadCharterPdf({ name: signature.name, email: user.email, signedAt: signature.signedAt });
    } catch {
      setError(t('downloadFailed'));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <section id="sign" className={styles.signCard + (signature ? ' ' + styles.signCardDone : required ? ' ' + styles.signCardRequired : '')}>
      {signature ? (
        <>
          <div className={styles.signedRow}>
            <span className={styles.signedIcon} aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6 9 17l-5-5" /></svg>
            </span>
            <div>
              <h2 className={styles.signTitle}>{t('signedTitle')}</h2>
              <p className={styles.signText}>
                {t('signedOn', {
                  name: signature.name,
                  date: new Date(signature.signedAt).toLocaleDateString(intlLocale(locale), { year: 'numeric', month: 'long', day: 'numeric' }),
                })}
              </p>
            </div>
          </div>
          <button type="button" className={styles.secondaryBtn} onClick={downloadSignedCopy} disabled={downloading}>
            {downloading ? t('downloadingPdf') : t('downloadSigned')}
          </button>
          {error && <p className={styles.error} role="alert">{error}</p>}
        </>
      ) : accountNames.length === 0 ? (
        <>
          <h2 className={styles.signTitle}>{t('signTitle')}</h2>
          <p className={styles.signText}>{t('signNoAccountName')}</p>
          <Link href="/dashboard/shaper/profile" className={styles.signBtn}>{t('signGoToProfile')}</Link>
        </>
      ) : (
        <form onSubmit={submit}>
          <h2 className={styles.signTitle}>{t('signTitle')}</h2>
          <p className={styles.signText}>{required ? t('signRequiredIntro') : t('signIntro')}</p>
          <label className={styles.fieldLabel} htmlFor="charter-name">{t('signName')}</label>
          <input
            ref={nameInput}
            id="charter-name"
            className={styles.input + (nameRejected ? ' ' + styles.inputRejected : '')}
            value={name}
            onChange={e => { setName(e.target.value); setNameRejected(false); }}
            maxLength={120}
            required
            autoComplete="off"
            aria-invalid={nameRejected || undefined}
            aria-describedby="charter-name-note"
          />
          {nameRejected
            ? <p id="charter-name-note" className={styles.error} role="alert">{t('signNameMismatch', { name: shownNames })}</p>
            : <p id="charter-name-note" className={styles.fieldHint}>{t('signNameHint', { name: shownNames })}</p>}
          <label className={styles.confirmRow}>
            <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} required />
            <span>{t('signConfirm')}</span>
          </label>
          {error && <p className={styles.error} role="alert">{error}</p>}
          <button type="submit" className={styles.signBtn} disabled={saving || !confirmed || !name.trim()}>
            {saving ? t('signing') : t('signSubmit')}
          </button>
        </form>
      )}
    </section>
  );
}
