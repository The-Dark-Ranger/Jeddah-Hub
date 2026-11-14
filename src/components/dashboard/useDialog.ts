'use client';

/* What every dashboard pop-up window needs, in one place: Escape closes it
 * through the same check as clicking outside (so unsaved changes still ask
 * first), keyboard focus moves into the window when it opens and goes back
 * to where it was when it closes, and the page behind it doesn't scroll. */
import { useCallback, useEffect, useRef } from 'react';

/** `requestClose` decides whether closing needs a confirmation. Give the
 *  returned ref to the element with role="dialog", which needs tabIndex={-1}. */
export function useDialog(open: boolean, requestClose: () => void) {
  const close = useRef(requestClose);
  useEffect(() => { close.current = requestClose; });

  useEffect(() => {
    if (!open) return;
    // Still the button that opened the window: ModalPortal attaches the
    // window itself a render later.
    const returnTo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented || e.isComposing) return;
      e.preventDefault();
      close.current();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      if (returnTo?.isConnected) returnTo.focus();
    };
  }, [open]);

  // A callback ref rather than an effect, because the window only exists once
  // ModalPortal has mounted, after `open` turned true.
  return useCallback((node: HTMLElement | null) => { node?.focus(); }, []);
}
