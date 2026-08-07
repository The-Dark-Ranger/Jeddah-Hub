'use client';

import { useEffect, useState } from 'react';
import { doc, getDoc, updateDoc, setDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { useTranslations } from 'next-intl';
import AvatarUploader from '@/components/AvatarUploader';
import styles from './Profile.module.css';

interface ProfileForm {
  displayName: string;
  displayNameAr: string;
  photoURL: string;
  bio: string;
  linkedin: string;
  twitter: string;
  instagram: string;
}

const empty: ProfileForm = { displayName: '', displayNameAr: '', photoURL: '', bio: '', linkedin: '', twitter: '', instagram: '' };

export default function MyProfile() {
  const { user } = useAuth();
  const t = useTranslations('Dashboard');

  const [form, setForm]                   = useState<ProfileForm>(empty);
  const [myProjects, setMyProjects] = useState<{id: string; title: string}[]>([]);
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
          linkedin:      d.linkedin      || '',
          twitter:       d.twitter       || '',
          instagram:     d.instagram     || '',
        });
      }
      setLoaded(true);
    });

    // Filter server-side so archived initiatives are never downloaded.
    getDocs(query(collection(db, 'initiatives'), where('status', '==', 'active'))).then(snap => {
      const joined: {id: string; title: string}[] = [];
      snap.docs.forEach(d => {
        const data = d.data();
        if (data.members?.some((m: any) => m === user.uid || m?.userId === user.uid)) {
          joined.push({ id: d.id, title: data.title || d.id });
        }
      });
      setMyProjects(joined);
    }).catch(() => setMyProjects([]));
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

  if (!user || !loaded) return <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>{t('loading')}</div>;

  return (
    <form className={styles.page} onSubmit={handleSave}>

      {/* Page header */}
      <div className={styles.pageHeader}>
        <h2 className={styles.pageTitle}>{t('editProfile')}</h2>
        <p className={styles.pageSubtitle}>{t('editProfileSubtitle')}</p>
      </div>

      {/* Account info (read-only) */}
      <div className={styles.card}>
        <p className={styles.cardTitle}>{t('accountInfo')}</p>
        <div className={styles.infoGrid}>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>{t('profileEmail')}</span>
            <span className={styles.infoValue}>{user.email}</span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>{t('profileRole')}</span>
            <span className={styles.roleBadge}>{user.role?.replace(/_/g, ' ')}</span>
          </div>
        </div>
      </div>

      {/* Profile info */}
      <div className={styles.card}>
        <p className={styles.cardTitle}>{t('profileSection')}</p>
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
            <textarea className={styles.textarea} value={form.bio} onChange={set('bio')} placeholder={t('phBio')} rows={3} />
          </div>
        </div>
      </div>

      {/* Social links */}
      <div className={styles.card}>
        <p className={styles.cardTitle}>{t('socialsSection')}</p>
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

      {/* Active projects */}
      <div className={styles.card}>
        <p className={styles.cardTitle}>{t('profileActiveProjects')}</p>
        {myProjects.length === 0 ? (
          <p className={styles.countLabel} style={{ textAlign: 'center', padding: '0.5rem 0' }}>
            {t('noActiveProjects')}
          </p>
        ) : (
          <ul className={styles.projectList}>
            {myProjects.map(p => (
              <li key={p.id} className={styles.projectItem}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                </svg>
                {p.title}
              </li>
            ))}
          </ul>
        )}
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
  );
}
