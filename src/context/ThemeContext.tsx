'use client';

import { createContext, useCallback, useContext, useLayoutEffect, useState } from 'react';
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
  } catch { /* storage blocked — fall through */ }
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

  const toggleTheme = useCallback((e?: { clientX: number; clientY: number }) => {
    const next: Theme = theme === 'light' ? 'dark' : 'light';
    const html = document.documentElement;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!document.startViewTransition || reduceMotion) {
      setTheme(next);
      return;
    }

    // Reveal the new theme as a circle growing from the toggle button.
    const x = e?.clientX ?? window.innerWidth;
    const y = e?.clientY ?? 0;
    const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
    html.style.setProperty('--theme-x', `${x}px`);
    html.style.setProperty('--theme-y', `${y}px`);
    html.style.setProperty('--theme-r', `${radius}px`);
    html.setAttribute('data-theme-switch', '');

    const vt = document.startViewTransition(() => {
      html.setAttribute('data-theme', next);
      flushSync(() => setTheme(next));
    });
    vt.finished.finally(() => html.removeAttribute('data-theme-switch'));
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
