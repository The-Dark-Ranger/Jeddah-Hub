'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import styles from './InstagramEmbed.module.css';

declare global {
  interface Window {
    instgrm?: { Embeds: { process: () => void } };
  }
}

/** Only a genuine post/reel/tv permalink is ever trusted enough to reach an
 *  href or Instagram's own embed script — this is the sole gate a pasted
 *  URL passes through. */
const PERMALINK_RE = /^https:\/\/(www\.)?instagram\.com\/(reel|p|tv)\/[A-Za-z0-9_-]+\/?/;

let scriptPromise: Promise<void> | null = null;

function loadEmbedScript(): Promise<void> {
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    if (window.instgrm) { resolve(); return; }
    const existing = document.querySelector<HTMLScriptElement>('script[data-instagram-embed]');
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('load failed')), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://www.instagram.com/embed.js';
    script.async = true;
    script.dataset.instagramEmbed = 'true';
    script.onload  = () => resolve();
    script.onerror = () => reject(new Error('load failed'));
    document.body.appendChild(script);
  });
  return scriptPromise;
}

/**
 * Embeds a single Instagram post/reel using Meta's official embed script.
 *
 * Instagram's script mutates the blockquote's DOM directly to insert an
 * iframe — outside React's control — so the container is keyed by URL to
 * force a clean remount rather than let React reconcile against a DOM tree
 * it no longer recognizes.
 *
 * The children rendered inside the blockquote double as the fallback: if the
 * embed script never loads (ad blockers commonly block instagram.com),
 * they stay on screen as a plain link instead of a blank gap.
 */
export default function InstagramEmbed({ url }: { url: string }) {
  const t = useTranslations('NewsPostPage');
  const clean = PERMALINK_RE.test(url) ? url : null;
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!clean) return;
    let cancelled = false;
    loadEmbedScript()
      .then(() => { if (!cancelled) window.instgrm?.Embeds.process(); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [clean]);

  if (!clean) return null;

  return (
    <div className={styles.wrap} key={clean}>
      <blockquote
        className={'instagram-media ' + styles.blockquote}
        data-instgrm-permalink={clean}
        data-instgrm-version="14"
      >
        <a
          href={clean}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.fallback}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <rect x="2" y="2" width="20" height="20" rx="5"/>
            <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
            <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
          </svg>
          {failed ? t('instagramUnavailable') : t('instagramViewPost')}
        </a>
      </blockquote>
    </div>
  );
}
