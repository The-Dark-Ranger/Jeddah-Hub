/**
 * Inline scripts injected into <head> by the root layout, run synchronously
 * before the first paint. Kept in a plain (non-'use client') module so the
 * server layout receives the actual strings, exporting them from a client
 * module would hand the server an opaque client reference instead.
 */

/** The splash stays a full second, so its entrance plays out and it reads
 *  as a deliberate load rather than a flicker. */
export const SPLASH_MIN_VISIBLE_MS = 1000;
/** Never hold the user back longer than this, however slow the page is
 *  (only reached on a slow network; normally it leaves at one second). */
export const SPLASH_MAX_VISIBLE_MS = 1500;
/** Matches the curtain-lift exit in SplashScreen.module.css (delay + duration). */
export const SPLASH_DISMISS_MS = 560;

/**
 * Inline script run in <head> before first paint. The server already sets
 * data-theme from the jh-theme cookie; this only fills the gap when the cookie
 * is missing but localStorage still remembers an explicit choice, so a
 * returning visitor never sees the wrong theme flash in. With neither, the
 * prefers-color-scheme CSS fallback in globals.css handles it.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var d=document.documentElement;if(!d.getAttribute('data-theme')){var t=localStorage.getItem('jh-theme');if(t==='dark'||t==='light')d.setAttribute('data-theme',t);}}catch(e){}})();`;

/**
 * Inline script run synchronously in <head>, before the first paint. It
 * decides whether this load shows the splash (first visit in the session, or
 * a reload) by setting html[data-splash], which the CSS uses to reveal the
 * server-rendered overlay. Deciding here rather than in a React effect is
 * what stops the page from painting first and the splash popping over it
 * after hydration. A hard timeout clears the flag even if React never
 * hydrates, so a script error can never strand the overlay on screen.
 * The attribute's value is the page's resolved theme ("light" or "dark"),
 * which the splash uses for its colours.
 */
export const SPLASH_INIT_SCRIPT = `(function(){try{var d=document.documentElement;var n=performance.getEntriesByType&&performance.getEntriesByType('navigation')[0];var r=n&&n.type==='reload';var f=!sessionStorage.getItem('jh-visited');if(f)sessionStorage.setItem('jh-visited','1');if(f||r){var t=d.getAttribute('data-theme');if(t!=='dark'&&t!=='light')t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';d.setAttribute('data-splash',t);setTimeout(function(){d.removeAttribute('data-splash')},${SPLASH_MAX_VISIBLE_MS + SPLASH_DISMISS_MS + 1500});}}catch(e){}})();`;
