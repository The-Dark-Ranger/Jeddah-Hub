'use client';

import { useEffect, useState } from 'react';
import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { DEFAULT_MEMBER_PASSWORD, DEFAULT_PASSWORD_FLAG } from '@/lib/memberAccounts';
import { normalizeRole } from '@/lib/role';
import { useAuth } from '@/context/AuthContext';
import DashSkeleton from '@/components/dashboard/DashSkeleton';
import { useTranslations } from 'next-intl';
import AvatarUploader from '@/components/AvatarUploader';
import styles from './Profile.module.css';

interface ProfileForm {
  displayName: string;
  displayNameAr: string;
  photoURL: string;
  bio: string;
  bioAr: string;
  linkedin: string;
  twitter: string;
  instagram: string;
}

const empty: ProfileForm = {
  displayName: '', displayNameAr: '', photoURL: '', bio: '', bioAr: '',
  linkedin: '', twitter: '', instagram: '',
};

// Long enough for a real bio, short enough that shaper/curator cards
// across the site (About page, homepage) stay a reasonable, consistent size.
const BIO_MAX_LENGTH = 300;
const PASSWORD_MIN = 8;

const ICONS = {
  account: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8',
  profile: 'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z',
  social: 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71',
  lock: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4',
};

function SectionTitle({ icon, children }: { icon: keyof typeof ICONS; children: React.ReactNode }) {
  return (
    <p className={styles.cardTitle}>
      <span className={styles.cardIcon} aria-hidden="true">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={ICONS[icon]} /></svg>
      </span>
      {children}
    </p>
  );
}

/** Change password: re-authenticates with the current one first, as
 *  Firebase requires for sensitive account changes. */
function ChangePassword() {
  const t = useTranslations('Dashboard');
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    const u = auth?.currentUser;
    if (!u?.email) return;
    if (next.length < PASSWORD_MIN) return setMsg({ ok: false, text: t('pwTooShort', { n: PASSWORD_MIN }) });
    if (next === DEFAULT_MEMBER_PASSWORD || next === current) return setMsg({ ok: false, text: t('pwNotNew') });
    if (next !== confirmPw) return setMsg({ ok: false, text: t('pwMismatch') });
    setBusy(true);
    try {
      await reauthenticateWithCredential(u, EmailAuthProvider.credential(u.email, current));
      await updatePassword(u, next);
      try { sessionStorage.removeItem(DEFAULT_PASSWORD_FLAG); } catch { /* ignore */ }
      window.dispatchEvent(new Event('jh-password-changed'));
      setCurrent(''); setNext(''); setConfirmPw('');
      setMsg({ ok: true, text: t('pwChanged') });
    } catch (err) {
      const code = (err as { code?: string } | null)?.code ?? '';
      setMsg({
        ok: false,
        text: code === 'auth/wrong-password' || code === 'auth/invalid-credential' ? t('pwWrongCurrent')
          : code === 'auth/too-many-requests' ? t('pwTooMany')
          : code === 'auth/weak-password' || code === 'auth/password-does-not-meet-requirements' ? t('pwTooShort', { n: PASSWORD_MIN })
          : t('saveFailed'),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form id="password" className={styles.card + ' ' + styles.passwordCard} onSubmit={submit}>
      <SectionTitle icon="lock">{t('pwTitle')}</SectionTitle>
      <p className={styles.cardIntro}>{t('pwIntro')}</p>
      <div className={styles.pwGrid}>
        <div className={styles.formField}>
          <label className={styles.label} htmlFor="pw-current">{t('pwCurrent')}</label>
          <input id="pw-current" className={styles.input} type="password" autoComplete="current-password" value={current} onChange={e => setCurrent(e.target.value)} required />
        </div>
        <div className={styles.formField}>
          <label className={styles.label} htmlFor="pw-new">{t('pwNew')}</label>
          <input id="pw-new" className={styles.input} type="password" autoComplete="new-password" minLength={PASSWORD_MIN} value={next} onChange={e => setNext(e.target.value)} required />
        </div>
        <div className={styles.formField}>
          <label className={styles.label} htmlFor="pw-confirm">{t('pwConfirm')}</label>
          <input id="pw-confirm" className={styles.input} type="password" autoComplete="new-password" minLength={PASSWORD_MIN} value={confirmPw} onChange={e => setConfirmPw(e.target.value)} required />
        </div>
      </div>
      <div className={styles.pwFooter}>
        <button type="submit" className={styles.secondaryBtn} disabled={busy}>{busy ? t('savingDots') : t('pwSubmit')}</button>
        {msg && <span className={msg.ok ? styles.savedMsg : styles.errorMsg} role="status">{msg.text}</span>}
      </div>
    </form>
  );
}

export default function MyProfile() {
  const { user } = useAuth();
  const t = useTranslations('Dashboard');

  const [form, setForm]                   = useState<ProfileForm>(empty);
  const [saving, setSaving]               = useState(false);
  const [saved, setSaved]                 = useState(false);
  const [loaded, setLoaded]               = useState(false);

  useEffect(() => {
    if (!user) return;

    getDoc(doc(db, 'users', user.uid)).then(snap => {
      if (snap.exists()) {
        const d = snap.data();
        setForm({
          displayName:   d.displayName   || '',
          displayNameAr: d.displayNameAr || '',
          photoURL:      d.photoURL      || '',
          bio:           d.bio           || '',
          bioAr:         d.bioAr         || '',
          linkedin:      d.linkedin      || '',
          twitter:       d.twitter       || '',
          instagram:     d.instagram     || '',
        });
      }
      setLoaded(true);
    });
  }, [user]);

  const set = (k: keyof ProfileForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setSaved(false);
    try {
      const publicFields = {
        displayName:   form.displayName.trim(),
        displayNameAr: form.displayNameAr.trim(),
        photoURL:      form.photoURL.trim(),
        bio:           form.bio.trim(),
        bioAr:         form.bioAr.trim(),
        linkedin:      form.linkedin.trim(),
        twitter:       form.twitter.trim(),
        instagram:     form.instagram.trim(),
      };
      await updateDoc(doc(db, 'users', user.uid), publicFields);
      // Mirror to public_profiles (never email) so About/homepage reflect
      // the edit immediately instead of waiting for next sign-in.
      await setDoc(doc(db, 'public_profiles', user.uid), publicFields, { merge: true }).catch(() => {});
      setSaved(true);
      setTimeout(() => setSaved(false), 3500);
    } catch (err) {
      console.error(err);
      alert(t('saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  if (!user || !loaded) return <DashSkeleton rows={3} label={t('loading')} />;

  const role = normalizeRole(user.role);
  const roleLabel = role ? ({
    curator: t('roleLabelCurator'), vice_curator: t('roleLabelViceCurator'), impact_officer: t('roleLabelImpactOfficer'),
    shaper: t('roleLabelShaper'), alumni: t('roleLabelAlumni'),
  } as Record<string, string>)[role] : '';
  const shownName = form.displayName.trim() || user.email?.split('@')[0] || '';

  return (
    <div className={styles.page}>

      {/* Identity header */}
      <div className={styles.hero}>
        <div className={styles.heroAvatar}>
          {form.photoURL
            ? <img src={form.photoURL} alt="" />
            : <span aria-hidden="true">{shownName.charAt(0).toUpperCase()}</span>}
        </div>
        <div className={styles.heroText}>
          <h2 className={styles.heroName}>{shownName}</h2>
          {form.displayNameAr && <p className={styles.heroNameAr} dir="rtl">{form.displayNameAr}</p>}
          <div className={styles.heroMeta}>
            {roleLabel && <span className={styles.roleBadge}>{roleLabel}</span>}
            <span className={styles.heroEmail}>{user.email}</span>
          </div>
        </div>
      </div>
      <p className={styles.pageSubtitle}>{t('editProfileSubtitle')}</p>

    <form className={styles.formStack} onSubmit={handleSave}>
      {/* Profile info */}
      <div className={styles.card}>
        <SectionTitle icon="profile">{t('profileSection')}</SectionTitle>
        <div className={styles.formFields}>
          <div className={styles.socialsGrid}>
            <div className={styles.formField}>
              <label className={styles.label}>{t('displayName')}</label>
              <input className={styles.input} value={form.displayName} onChange={set('displayName')} placeholder={t('phDisplayName')} />
              <span className={styles.hint}>{t('displayNameHint')}</span>
            </div>
            <div className={styles.formField}>
              <label className={styles.label}>{t('displayNameAr')}</label>
              <input className={styles.input} value={form.displayNameAr} onChange={set('displayNameAr')} placeholder={t('phDisplayNameAr')} dir="rtl" />
              <span className={styles.hint}>{t('displayNameArHint')}</span>
            </div>
          </div>
          <div className={styles.formField}>
            <label className={styles.label}>{t('photoUrl')}</label>
            <AvatarUploader
              value={form.photoURL}
              onChange={v => setForm(f => ({ ...f, photoURL: v }))}
            />
          </div>
          <div className={styles.formField}>
            <label className={styles.label}>{t('bioLabel')}</label>
            <textarea
              className={styles.textarea}
              value={form.bio}
              onChange={set('bio')}
              placeholder={t('phBio')}
              rows={3}
              maxLength={BIO_MAX_LENGTH}
            />
            <p className={styles.charCount + (form.bio.length >= BIO_MAX_LENGTH ? ' ' + styles.charCountNearLimit : '')}>
              {form.bio.length}/{BIO_MAX_LENGTH}
            </p>
          </div>
          <div className={styles.formField}>
            <label className={styles.label}>{t('bioArLabel')}</label>
            <textarea
              className={styles.textarea}
              value={form.bioAr}
              onChange={set('bioAr')}
              placeholder={t('phBioAr')}
              rows={3}
              maxLength={BIO_MAX_LENGTH}
              dir="rtl"
            />
            <p className={styles.charCount + (form.bioAr.length >= BIO_MAX_LENGTH ? ' ' + styles.charCountNearLimit : '')}>
              {form.bioAr.length}/{BIO_MAX_LENGTH}
            </p>
            <span className={styles.hint}>{t('bioArHint')}</span>
          </div>
        </div>
      </div>

      {/* Social links */}
      <div className={styles.card}>
        <SectionTitle icon="social">{t('socialsSection')}</SectionTitle>
        <div className={styles.socialsGrid}>
          <div className={styles.formField}>
            <label className={styles.label}>{t('linkedinUrl')}</label>
            <input className={styles.input} value={form.linkedin} onChange={set('linkedin')} placeholder={t('phLinkedin')} type="url" />
          </div>
          <div className={styles.formField}>
            <label className={styles.label}>{t('twitterUrl')}</label>
            <input className={styles.input} value={form.twitter} onChange={set('twitter')} placeholder={t('phTwitter')} type="url" />
          </div>
          <div className={styles.formField}>
            <label className={styles.label}>{t('instagramUrl')}</label>
            <input className={styles.input} value={form.instagram} onChange={set('instagram')} placeholder={t('phInstagram')} type="url" />
          </div>
        </div>
        <p className={styles.previewHint}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          {t('socialsHint')}
        </p>
      </div>

      {/* Save button */}
      <div className={styles.footer}>
        <button type="submit" className={styles.saveBtn} disabled={saving}>
          {saving ? (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: 'spin 0.7s linear infinite' }}>
                <path d="M21 12a9 9 0 1 1-9-9"/>
              </svg>
              {t('savingProfile')}
            </>
          ) : t('saveProfile')}
        </button>
        {saved && (
          <span className={styles.savedMsg}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            {t('profileSaved')}
          </span>
        )}
      </div>
    </form>

      <ChangePassword />
    </div>
  );
}
