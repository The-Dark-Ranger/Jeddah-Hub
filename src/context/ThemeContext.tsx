'use client';

import { createContext, useCallback, useContext, useLayoutEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  /** Pass the click event to animate the switch outward from the pointer. */
  toggleTheme: (e?: { clientX: number; clientY: number }) => void;
}

const ThemeContext = createContext<ThemeContextType>({ theme: 'light', toggleTheme: () => {} });

function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  const attr = document.documentElement.getAttribute('data-theme');
  if (attr === 'dark' || attr === 'light') return attr;
  try {
    const saved = localStorage.getItem('jh-theme');
    if (saved === 'dark' || saved === 'light') return saved;
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
  } catch { /* storage blocked, fall through */ }
  return 'light';
}

function persistTheme(theme: Theme) {
  try { localStorage.setItem('jh-theme', theme); } catch { /* ignore */ }
  // Cookie lets the server render the right data-theme on the next request.
  try {
    document.cookie = `jh-theme=${theme};path=/;max-age=31536000;SameSite=Lax`;
  } catch { /* ignore */ }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  // Runs before paint, so a server/client theme difference never flashes.
  useLayoutEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    persistTheme(theme);
  }, [theme]);

  // True while a switch animation is running. A second tap mid-animation
  // would abort the first transition and snap, a visible jump on phones.
  const switching = useRef(false);

  const toggleTheme = useCallback((e?: { clientX: number; clientY: number }) => {
    if (switching.current) return;
    const next: Theme = theme === 'light' ? 'dark' : 'light';
    const html = document.documentElement;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduceMotion) {
      html.setAttribute('data-theme-switch', '');
      html.setAttribute('data-theme', next);
      flushSync(() => setTheme(next));
      requestAnimationFrame(() => requestAnimationFrame(() => html.removeAttribute('data-theme-switch')));
      return;
    }

    if (!document.startViewTransition) {
      // No View Transitions: one uniform colour fade for every element.
      switching.current = true;
      html.setAttribute('data-theme-fade', '');
      setTheme(next);
      setTimeout(() => {
        html.removeAttribute('data-theme-fade');
        switching.current = false;
      }, 350);
      return;
    }

    // Reveal the new theme as a circle growing from the toggle button. A
    // keyboard-triggered click reports (0, 0), so start from the top-end
    // corner (where the toggle lives) instead of the top-left.
    const w = document.documentElement.clientWidth;
    // Mobile toolbars can hide/show mid-animation and grow the viewport;
    // size the circle for the tallest the screen can get so it never stops
    // short of the bottom edge.
    const h = Math.max(window.innerHeight, window.visualViewport?.height ?? 0, window.screen?.height ?? 0);
    const fromPointer = e && (e.clientX !== 0 || e.clientY !== 0);
    const rtl = document.documentElement.dir === 'rtl';
    const x = fromPointer ? e.clientX : (rtl ? 0 : w);
    const y = fromPointer ? e.clientY : 0;
    const radius = Math.ceil(Math.hypot(Math.max(x, w - x), Math.max(y, h - y)));
    switching.current = true;

    const run = () => {
      html.setAttribute('data-theme-switch', '');
      const vt = document.startViewTransition(() => {
        html.setAttribute('data-theme', next);
        flushSync(() => setTheme(next));
      });
      // Driven from JS with literal pixel values (no CSS variables in the
      // keyframes): one clip-path animation on one pseudo-element, which
      // browsers can run on the compositor instead of repainting every frame.
      vt.ready.then(() => {
        html.animate(
          { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
          { duration: 480, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', pseudoElement: '::view-transition-new(root)' },
        );
      }).catch(() => { /* skipped (e.g. tab hidden), theme still applied */ });
      vt.finished.finally(() => {
        html.removeAttribute('data-theme-switch');
        switching.current = false;
      });
    };

    // The incoming theme's logo is display:none until now, so the browser
    // hasn't decoded it; decode it first (briefly capped) so it's already in
    // the new snapshot instead of popping in mid-animation.
    const pending = [...document.querySelectorAll<HTMLImageElement>(`.theme-${next}-only img`)]
      .filter(img => img.loading !== 'lazy')
      .map(img => (img.decode ? img.decode().catch(() => {}) : Promise.resolve()));
    Promise.race([Promise.all(pending), new Promise(r => setTimeout(r, 120))]).then(run);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
