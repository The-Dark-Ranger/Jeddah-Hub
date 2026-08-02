'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import styles from './InitiativeGallery.module.css';

interface Props {
  photos: string[];
  title: string;
  /** Initiative accent colour, used for the active thumbnail ring. */
  accent?: string;
}

/** Photo gallery for the initiative detail page: a main stage users can page
 *  through, a thumbnail strip, and a full-screen lightbox. Supports keyboard
 *  arrows, swipe, and RTL. */
export default function InitiativeGallery({ photos, title, accent }: Props) {
  const t = useTranslations('ProjectsPage');

  const [index, setIndex]       = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const [hidden, setHidden]     = useState<Set<number>>(new Set());

  const touchX    = useRef<number | null>(null);
  const stripRef  = useRef<HTMLDivElement>(null);

  // Photos that failed to load are dropped so the counter stays truthful.
  const usable = photos.filter((_, i) => !hidden.has(i));
  const total  = usable.length;
  const safeIx = Math.min(index, Math.max(0, total - 1));

  const go = useCallback((delta: number) => {
    if (total === 0) return;
    setIndex(i => (i + delta + total) % total);
  }, [total]);

  const openAt = (i: number) => { setIndex(i); setLightbox(true); };

  /* Keyboard: arrows page through, Escape leaves the lightbox.
   * Bound only while the lightbox is open so it never hijacks page keys. */
  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape')     setLightbox(false);
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft')  go(-1);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [lightbox, go]);

  /* Lock background scroll while the lightbox is open. */
  useEffect(() => {
    if (!lightbox) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [lightbox]);

  /* Keep the active thumbnail in view as the user pages through. */
  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;
    const active = strip.children[safeIx] as HTMLElement | undefined;
    active?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [safeIx]);

  const onTouchStart = (e: React.TouchEvent) => { touchX.current = e.touches[0].clientX; };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    touchX.current = null;
    if (Math.abs(dx) < 40) return;
    // In RTL the visual direction of a swipe is mirrored.
    const rtl = document.documentElement.dir === 'rtl';
    go(dx < 0 ? (rtl ? -1 : 1) : (rtl ? 1 : -1));
  };

  const markBroken = (originalIndex: number) =>
    setHidden(prev => new Set(prev).add(originalIndex));

  if (total === 0) return null;

  const current  = usable[safeIx];
  const multiple = total > 1;

  const arrows = (variant: 'stage' | 'lightbox') => multiple && (
    <>
      <button
        type="button"
        className={`${styles.nav} ${styles.navPrev} ${variant === 'lightbox' ? styles.navLightbox : ''}`}
        onClick={e => { e.stopPropagation(); go(-1); }}
        aria-label={t('galleryPrev')}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
      </button>
      <button
        type="button"
        className={`${styles.nav} ${styles.navNext} ${variant === 'lightbox' ? styles.navLightbox : ''}`}
        onClick={e => { e.stopPropagation(); go(1); }}
        aria-label={t('galleryNext')}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </button>
    </>
  );

  return (
    <section className={styles.wrap} aria-roledescription="carousel" aria-label={t('galleryTitle')}>
      <h3 className={styles.heading}>
        {t('galleryTitle')}
        {multiple && <span className={styles.count}>{safeIx + 1} / {total}</span>}
      </h3>

      {/* Main stage */}
      <div
        className={styles.stage}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <button
          type="button"
          className={styles.stageBtn}
          onClick={() => setLightbox(true)}
          aria-label={t('galleryExpand')}
        >
          {/* key forces a fresh element per photo so the fade-in replays */}
          <img
            key={current}
            src={current}
            alt={`${title} — ${safeIx + 1}`}
            className={styles.stageImg}
            loading="lazy"
            decoding="async"
            onError={() => markBroken(photos.indexOf(current))}
          />
          <span className={styles.expandHint}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/>
              <line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>
            </svg>
          </span>
        </button>
        {arrows('stage')}
      </div>

      {/* Thumbnail strip */}
      {multiple && (
        <div className={styles.strip} ref={stripRef}>
          {usable.map((src, i) => (
            <button
              key={src + i}
              type="button"
              className={styles.thumb + (i === safeIx ? ' ' + styles.thumbActive : '')}
              style={i === safeIx && accent ? { borderColor: accent } : undefined}
              onClick={() => setIndex(i)}
              aria-label={`${t('galleryGoTo')} ${i + 1}`}
              aria-current={i === safeIx}
            >
              <img src={src} alt="" className={styles.thumbImg} loading="lazy" decoding="async" />
            </button>
          ))}
        </div>
      )}

      {/* Full-screen lightbox */}
      {lightbox && (
        <div
          className={styles.lightbox}
          onClick={() => setLightbox(false)}
          role="dialog"
          aria-modal="true"
          aria-label={t('galleryTitle')}
        >
          <button
            type="button"
            className={styles.close}
            onClick={() => setLightbox(false)}
            aria-label={t('galleryClose')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>

          <div
            className={styles.lightboxStage}
            onClick={e => e.stopPropagation()}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          >
            <img key={current} src={current} alt={`${title} — ${safeIx + 1}`} className={styles.lightboxImg} />
            {arrows('lightbox')}
          </div>

          {multiple && (
            <div className={styles.lightboxCount} onClick={e => e.stopPropagation()}>
              {safeIx + 1} / {total}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
