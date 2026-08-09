'use client';

import { useCommunityStats } from '@/lib/useCommunityStats';

interface Props {
  kind: 'shapers' | 'initiatives';
  /** Shown while the live count loads (or if it fails) — a Server
   *  Component can't fetch Firestore client-side itself, so this renders
   *  inline wherever a hardcoded number used to sit. */
  fallback: string;
}

export default function LiveStat({ kind, fallback }: Props) {
  const { shaperCount, initiativeCount } = useCommunityStats();
  const count = kind === 'shapers' ? shaperCount : initiativeCount;
  return <>{count !== null ? count : fallback}</>;
}
