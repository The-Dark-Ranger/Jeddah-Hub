'use client';

import { useState } from 'react';
import styles from './InitiativeCover.module.css';

/** Two-letter monogram for a cover without a photo: "Tech J Shore" -> "TJ". */
function monogram(title: string): string {
  const words = title.trim().split(/\s+/).filter(Boolean);
  return (words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? '?').slice(0, 2)).toLocaleUpperCase();
}

interface Props {
  src?: string;
  title: string;
  /** The initiative's colour (#rrggbb); the fallback cover is drawn in it. */
  accent: string;
  /** Class for the <img> when there is a photo. */
  imgClassName?: string;
  /** Class for the fallback cover (it always fills its parent). */
  className?: string;
  /** Load the photo right away (above the fold) instead of lazily. */
  eager?: boolean;
}

/** An initiative's cover photo, used on the Initiatives page and in the
 *  initiative dashboards. Without a photo, or when it fails to load, it
 *  shows a designed cover instead: the initiative's colour as a gradient
 *  with its monogram and two soft rings, so every card keeps its shape. */
export default function InitiativeCover({ src, title, accent, imgClassName, className, eager }: Props) {
  const [failed, setFailed] = useState(false);
  if (src && !failed) {
    return <img src={src} alt="" className={imgClassName} loading={eager ? undefined : 'lazy'} decoding="async" onError={() => setFailed(true)} />;
  }
  return (
    <div className={styles.cover + (className ? ' ' + className : '')} style={{ '--cover-accent': accent } as React.CSSProperties} aria-hidden="true">
      <span className={styles.ring1} />
      <span className={styles.ring2} />
      <span className={styles.monogram}>{monogram(title)}</span>
    </div>
  );
}
