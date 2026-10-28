'use client';

/* Home page: a selection of current Shapers. */
import { useEffect, useState } from 'react';
import { loadFirestore } from '@/lib/loadFirestore';
import { useLocale, useTranslations } from 'next-intl';
import styles from '@/app/[locale]/Home.module.css';
import { AVATAR_GRADIENTS, avatarGradient, initials } from '@/lib/avatarUtils';
import { normalizeRole } from '@/lib/role';

export interface Shaper {
  uid: string;
  displayName: string;
  displayNameAr?: string;
  role: string;
  photoURL?: string;
}

// Firestore 'in' matching is exact-string, so this has to enumerate every
// casing/spacing variant the app has ever written to `role` (Firestore
// rules' isCurator()/isImpactOfficer() already tolerate both
// "vice_curator"/"vice curator" and "impact_officer"/"impact officer"),
// otherwise a vice curator or impact officer stored in one of those
// variants would be silently excluded from this query.
const SHAPER_ROLES = [
  'shaper', 'alumni', 'curator',
  'vice_curator', 'vice curator',
  'impact_officer', 'impact officer',
];

/** `initial`: members loaded on the server (see HomeSections); when absent
 *  they are fetched in the browser instead. */
export default function HomeShapers({ initial }: { initial?: Shaper[] }) {
  const t      = useTranslations('HomePage');
  const tRole  = useTranslations('Role');
  const locale = useLocale();
  const [shapers, setShapers] = useState<Shaper[]>(initial ?? []);
  const [loaded, setLoaded]   = useState(!!initial);

  useEffect(() => {
    if (initial) return;
    // Public homepage, reads the public_profiles mirror (no email field,
    // see firestore.rules) rather than the private `users` collection, and
    // scopes to shaper-family roles with a capped download.
    // db can be undefined if Firebase failed to initialize (missing env
    // vars), collection()/query() throw synchronously in that case. Building
    // the query inside this initial .then() turns that throw into a normal
    // promise rejection, so the .catch() below handles it the same way it
    // already handles a getDocs() failure, keeping the homepage rendering.
    loadFirestore()
      .then(({ collection, getDocs, query, where, limit, db }) => getDocs(query(collection(db, 'public_profiles'), where('role', 'in', SHAPER_ROLES), limit(30))))
      .then(snap => {
        const list = snap.docs
          .map(d => ({ uid: d.id, ...d.data() } as { uid: string; displayName?: string; displayNameAr?: string; role?: string; photoURL?: string; hidden?: boolean }))
          .filter(u => u.displayName && !u.hidden)
          .map((u): Shaper => ({
            uid:           u.uid,
            displayName:   u.displayName ?? '',
            displayNameAr: u.displayNameAr || '',
            role:          u.role ?? '',
            photoURL:      u.photoURL || '',
          }));
        setShapers(list.slice(0, 10));
        setLoaded(true);
      }).catch(() => setLoaded(true));
  }, [initial]);

  if (!loaded) return (
    <div className={styles.membersGrid}>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className={styles.memberCard} style={{ opacity: 0.35 }}>
          <div className={styles.memberAvatar} style={{ background: AVATAR_GRADIENTS[i % AVATAR_GRADIENTS.length] }} />
          <div style={{ height: 14, background: 'var(--border-color)', borderRadius: 6, width: '70%', margin: '0 auto' }} />
        </div>
      ))}
    </div>
  );

  return (
    <div className={styles.membersGrid}>
      {shapers.map((s, i) => {
        const name = locale === 'ar' && s.displayNameAr ? s.displayNameAr : s.displayName;
        return (
          <div key={s.uid} className={styles.memberCard}>
            {s.photoURL
              ? <img src={s.photoURL} alt={name} className={styles.memberAvatarImg}
                  loading="lazy" decoding="async"
                  onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
              : <div className={styles.memberAvatar} style={{ background: avatarGradient(s.uid, i) }}>
                  {initials(name)}
                </div>
            }
            <div className={styles.memberName}>{name}</div>
            <div className={styles.memberRole}>{normalizeRole(s.role) === 'alumni' ? tRole('alumni') : t('globalShaper')}</div>
          </div>
        );
      })}
    </div>
  );
}
