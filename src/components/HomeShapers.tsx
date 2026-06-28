'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import styles from '@/app/[locale]/Home.module.css';

const AVATAR_GRADIENTS = [
  'linear-gradient(135deg,#0f5a9f,#1a7fd4)',
  'linear-gradient(135deg,#10b981,#34d399)',
  'linear-gradient(135deg,#7c3aed,#a78bfa)',
  'linear-gradient(135deg,#f59e0b,#fbbf24)',
  'linear-gradient(135deg,#0891b2,#22d3ee)',
];

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('');
}

interface Shaper { uid: string; displayName: string; displayNameAr?: string; role: string; photoURL?: string; }

export default function HomeShapers() {
  const t      = useTranslations('HomePage');
  const locale = useLocale();
  const [shapers, setShapers] = useState<Shaper[]>([]);
  const [loaded, setLoaded]   = useState(false);

  useEffect(() => {
    getDocs(collection(db, 'users')).then(snap => {
      const roles = ['shaper', 'alumni', 'curator', 'vice_curator', 'impact_officer'];
      const list = snap.docs
        .map(d => ({ uid: d.id, ...d.data() } as any))
        .filter((u: any) => roles.includes(u.role) && u.displayName)
        .map((u: any): Shaper => ({
          uid:           u.uid,
          displayName:   u.displayName,
          displayNameAr: u.displayNameAr || '',
          role:          u.role,
          photoURL:      u.photoURL || '',
        }));
      setShapers(list.slice(0, 10));
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  if (!loaded) return (
    <div className={styles.membersGrid}>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className={styles.memberCard} style={{ opacity: 0.35 }}>
          <div className={styles.memberAvatar} style={{ background: AVATAR_GRADIENTS[i % AVATAR_GRADIENTS.length] }} />
          <div className={styles.memberName} style={{ height: 14, background: 'var(--border-color)', borderRadius: 6, width: '70%' }} />
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
                  onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
              : <div className={styles.memberAvatar} style={{ background: AVATAR_GRADIENTS[i % AVATAR_GRADIENTS.length] }}>
                  {initials(name)}
                </div>
            }
            <div className={styles.memberName}>{name}</div>
            <div className={styles.memberRole}>{t('globalShaper')}</div>
          </div>
        );
      })}
    </div>
  );
}
