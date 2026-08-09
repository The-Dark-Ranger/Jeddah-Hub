'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs, getCountFromServer, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';

/** Live community/initiative counts, shared by every page that shows them
 *  (Home, Who We Are, Become a Shaper) so they can never drift out of sync
 *  with each other the way separately hardcoded numbers did. Mirrors the
 *  exact query/counting logic the About page originated: current shapers
 *  plus curator-tier roles count toward "shapers" (alumni are shown as
 *  their own separate group, not counted here), and initiatives exclude
 *  Hub Activity docs (which live in the same collection, tagged
 *  type:'hub_activity'). */
export function useCommunityStats() {
  const [shaperCount, setShaperCount]         = useState<number | null>(null);
  const [initiativeCount, setInitiativeCount] = useState<number | null>(null);

  useEffect(() => {
    const roleVariants = [
      'shaper', 'alumni', 'curator',
      'vice_curator', 'vice curator',
      'impact_officer', 'impact officer',
    ];
    Promise.all([
      getDocs(query(collection(db, 'public_profiles'), where('role', 'in', roleVariants))),
      getCountFromServer(collection(db, 'initiatives')),
      getCountFromServer(query(collection(db, 'initiatives'), where('type', '==', 'hub_activity'))),
    ]).then(([usersSnap, initCount, activityCount]) => {
      const normRole = (r: unknown) => (typeof r === 'string' ? r.toLowerCase().replace(/\s+/g, '_') : '');
      const active = usersSnap.docs
        .map(d => d.data() as any)
        .filter(u => u.displayName && ['shaper', 'curator', 'vice_curator', 'impact_officer'].includes(normRole(u.role)));
      setShaperCount(active.length);
      setInitiativeCount(initCount.data().count - activityCount.data().count);
    }).catch(() => { /* leave both at null — callers fall back to static copy */ });
  }, []);

  return { shaperCount, initiativeCount };
}
