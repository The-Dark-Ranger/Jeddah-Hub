'use client';

import { usePathname } from 'next/navigation';

/**
 * Replays the page-enter animation on every client-side navigation.
 *
 * The layout's wrapper element persists across route changes, so a CSS
 * animation declared on it only ever runs once — on first paint. Keying the
 * inner element by pathname remounts it per route, which restarts the
 * animation. The browser's View Transitions API only covers cross-document
 * navigation, so it does not help here.
 */
export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return <div key={pathname} className="page-enter">{children}</div>;
}
