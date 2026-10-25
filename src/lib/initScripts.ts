/**
 * Inline scripts injected into <head> by the root layout, run synchronously
 * before the first paint. Kept in a plain (non-'use client') module so the
 * server layout receives the actual strings, exporting them from a client
 * module would hand the server an opaque client reference instead.
 */

/** Floor, so the splash reads as a deliberate load rather than a flicker. */
export const SPLASH_MIN_VISIBLE_MS = 550;
/** Never hold the user back longer than this, however slow the page is. */
export const SPLASH_MAX_VISIBLE_MS = 1500;
/** Matches the curtain-lift exit in SplashScreen.module.css (delay + duration). */
export const SPLASH_DISMISS_MS = 460;

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
 */
export const SPLASH_INIT_SCRIPT = `(function(){try{var d=document.documentElement;var n=performance.getEntriesByType&&performance.getEntriesByType('navigation')[0];var r=n&&n.type==='reload';var f=!sessionStorage.getItem('jh-visited');if(f)sessionStorage.setItem('jh-visited','1');if(f||r){d.setAttribute('data-splash','');setTimeout(function(){d.removeAttribute('data-splash')},${SPLASH_MAX_VISIBLE_MS + SPLASH_DISMISS_MS + 1500});}}catch(e){}})();`;
