'use client';

/* After a language switch reloads the page, plays the short crossfade (see data-lang-switch in globals.css). */
import { useEffect } from 'react';

export default function LangSwitchHandler() {
  useEffect(() => {
    try {
      if (sessionStorage.getItem('jh-lang-switch')) {
        sessionStorage.removeItem('jh-lang-switch');
        document.documentElement.setAttribute('data-lang-switch', '');
        const timer = setTimeout(() => {
          document.documentElement.removeAttribute('data-lang-switch');
        }, 600);
        return () => clearTimeout(timer);
      }
    } catch { /* ignore */ }
  }, []);
  return null;
}
