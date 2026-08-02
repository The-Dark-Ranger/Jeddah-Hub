'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Renders popup content directly under <body>.
 *
 * `position: fixed` is only viewport-relative while no ancestor establishes a
 * containing block. A `transform`, `filter`, `perspective`, `backdrop-filter`
 * or `contain` anywhere up the tree silently re-anchors the element to that
 * ancestor instead — which is how every modal on this site ended up rendering
 * at the top of the page content rather than centred on screen.
 *
 * Portalling to <body> makes popups immune to whatever the page wraps them in.
 * Returns null until mounted so server and first client render agree.
 */
export default function ModalPortal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!mounted || typeof document === 'undefined') return null;
  return createPortal(children, document.body);
}
