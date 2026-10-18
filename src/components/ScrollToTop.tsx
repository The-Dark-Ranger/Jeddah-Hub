'use client';

import { useEffect, useLayoutEffect, useRef } from 'react';
import { usePathname } from '@/i18n/routing';

/** Opens every newly visited page at its very top, instantly.
 *
 *  With the site-wide `scroll-behavior: smooth`, a navigation used to start
 *  wherever the previous page was scrolled (often the footer) and then glide
 *  up — and stop just short of the top, under the sticky navbar. Back/forward
 *  keeps the browser's own scroll restoration, and #anchor links are left
 *  alone. Uses the locale-free pathname, so switching language doesn't jump. */
export default function ScrollToTop() {
  const pathname = usePathname();
  const isFirst = useRef(true);
  const fromHistory = useRef(false);

  useEffect(() => {
    const onPop = () => { fromHistory.current = true; };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useLayoutEffect(() => {
    if (isFirst.current) { isFirst.current = false; return; }
    if (fromHistory.current) { fromHistory.current = false; return; }
    if (window.location.hash) return;
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname]);

  return null;
}
