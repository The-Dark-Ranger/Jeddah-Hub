'use client';

import { ViewTransition } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Crossfades between routes on client-side navigation.
 *
 * Next.js route navigations run inside a React Transition, so a keyed
 * <ViewTransition> sees the old page exit and the new one enter and the
 * browser animates both (the `page-out` / `page-in` classes in globals.css).
 * Browsers without the View Transitions API swap instantly, and the
 * `page-enter` class gives them the old CSS fade-in instead.
 *
 * `scope="site"` (root layout) collapses every /dashboard/* path to one key,
 * so moving between dashboard pages doesn't remount the dashboard layout —
 * its sidebar, auth check and loaded data stay put. The dashboard layout
 * wraps its own content area in a `scope="section"` instance instead, so
 * only that panel animates there.
 */
export default function PageTransition({
  children,
  scope = 'site',
}: {
  children: React.ReactNode;
  scope?: 'site' | 'section';
}) {
  const pathname = usePathname();
  const key = scope === 'site' ? siteKey(pathname) : pathname;

  return (
    <ViewTransition key={key} enter="page-in" exit="page-out" default="none">
      <div className="page-enter">{children}</div>
    </ViewTransition>
  );
}

function siteKey(pathname: string) {
  const segments = pathname.split('/').filter(Boolean);
  const [locale, section] = segments;
  return section === 'dashboard' ? `/${locale}/dashboard` : pathname;
}
