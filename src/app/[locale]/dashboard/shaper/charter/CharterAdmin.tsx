'use client';

import { useCallback, useEffect, useState } from 'react';
import { collection, deleteDoc, doc, getDocs } from 'firebase/firestore';
import { useLocale, useTranslations } from 'next-intl';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { normalizeRole } from '@/lib/role';
import { getRequireSignature, setRequireSignature, SIGNATURES, type CharterSignature } from '@/lib/charterSignature';
import styles from './CharterSign.module.css';

const MEMBER_ROLES = ['curator', 'vice_curator', 'impact_officer', 'shaper', 'alumni'];

interface Member { uid: string; name: string; role: string; }

/** Curators (and vice curators) switch charter sign-off on or off and see
 *  who has signed. Rendered above the Charter for them only. */
export default function CharterAdmin() {
  const t = useTranslations('CharterPage');
  const tr = useTranslations('Role');
  const locale = useLocale();
  const { user } = useAuth();
  const [required, setRequired] = useState<boolean | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [signatures, setSignatures] = useState<Record<string, CharterSignature>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const [req, usersSnap, sigSnap] = await Promise.all([
        getRequireSignature(),
        getDocs(collection(db, 'users')),
        getDocs(collection(db, SIGNATURES)),
      ]);
      setRequired(req);
      setMembers(usersSnap.docs
        .map(d => ({ uid: d.id, name: (d.data().displayName as string) || (d.data().email as string) || d.id, role: normalizeRole(d.data().role) }))
        .filter(m => MEMBER_ROLES.includes(m.role))
        .sort((a, b) => a.name.localeCompare(b.name)));
      setSignatures(Object.fromEntries(sigSnap.docs.map(d => [d.id, d.data() as CharterSignature])));
    } catch {
      setError(t('adminLoadFailed'));
    }
  }, [t]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch
  useEffect(() => { load(); }, [load]);

  const toggle = async () => {
    if (required === null) return;
    setBusy(true); setError('');
    try {
      await setRequireSignature(!required, user?.email);
      setRequired(!required);
    } catch {
      setError(t('adminSaveFailed'));
    } finally {
      setBusy(false);
    }
  };

  /** New term: everyone signs again. */
  const reset = async () => {
    if (!confirm(t('resetConfirm'))) return;
    setBusy(true); setError('');
    try {
      await Promise.all(Object.keys(signatures).map(uid => deleteDoc(doc(db, SIGNATURES, uid))));
      setSignatures({});
      window.dispatchEvent(new Event('jh-charter-changed'));
    } catch {
      setError(t('adminSaveFailed'));
    } finally {
      setBusy(false);
    }
  };

  const signedCount = members.filter(m => signatures[m.uid]).length;
  const fmt = (iso: string) => new Date(iso).toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <section className={styles.adminCard} aria-labelledby="charter-admin-title">
      <div className={styles.adminHead}>
        <div>
          <h2 id="charter-admin-title" className={styles.adminTitle}>{t('adminTitle')}</h2>
          <p className={styles.adminHint}>{required ? t('adminOnHint') : t('adminOffHint')}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={!!required}
          aria-label={t('adminToggleLabel')}
          className={styles.switch + (required ? ' ' + styles.switchOn : '')}
          onClick={toggle}
          disabled={busy || required === null}
        >
          <span className={styles.switchKnob} />
        </button>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.progressRow}>
        <span className={styles.progressText}>{t('adminSignedCount', { signed: signedCount, total: members.length })}</span>
        <div className={styles.progressBar} aria-hidden="true">
          <span style={{ width: members.length ? `${(signedCount / members.length) * 100}%` : 0 }} />
        </div>
      </div>

      <div className={styles.adminActions}>
        <button type="button" className={styles.linkBtn} onClick={() => setOpen(o => !o)} aria-expanded={open}>
          {open ? t('adminHideList') : t('adminShowList')}
        </button>
        {signedCount > 0 && (
          <button type="button" className={styles.linkBtnDanger} onClick={reset} disabled={busy}>{t('adminReset')}</button>
        )}
      </div>

      {open && (
        <ul className={styles.memberList}>
          {members.map(m => {
            const sig = signatures[m.uid];
            return (
              <li key={m.uid} className={styles.memberRow}>
                <span className={styles.memberName}>{m.name}<span className={styles.memberRole}>{tr.has(m.role as 'shaper') ? tr(m.role as 'shaper') : m.role}</span></span>
                {sig
                  ? <span className={styles.chipSigned}>{t('adminSignedOn', { date: fmt(sig.signedAt) })}</span>
                  : <span className={styles.chipPending}>{t('adminNotSigned')}</span>}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
