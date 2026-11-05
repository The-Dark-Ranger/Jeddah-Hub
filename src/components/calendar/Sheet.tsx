'use client';

/* Calendar: the panel events and forms open in. A sheet from the bottom on
 * phones; on larger screens a side panel (details, this week) or a centred
 * dialog (forms). Portalled to <body> so it always covers the page. */
import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import ModalPortal from '@/components/ModalPortal';
import { Icon } from './Icon';
import styles from './Calendar.module.css';

interface Props {
  title?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** 'side' for details and lists, 'form' for full-height forms on phones. */
  variant?: 'side' | 'form';
}

export default function Sheet({ title, onClose, children, footer, variant = 'side' }: Props) {
  const t = useTranslations('Calendar');
  const panelRef = useRef<HTMLDivElement>(null);
  // Latest onClose without re-running the open/close effect on every render.
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeRef.current(); };
    document.addEventListener('keydown', onKey);
    const overflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.documentElement.style.overflow = overflow;
      previous?.focus?.();
    };
  }, []);

  return (
    <ModalPortal>
      <div
        className={`${styles.overlay} ${variant === 'side' ? styles.side : styles.full}`}
        onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div className={styles.panel} role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined} tabIndex={-1} ref={panelRef}>
          <div className={styles.grip} aria-hidden="true" />
          <div className={styles.panelHead}>
            <div className={styles.panelTitle}>{title}</div>
            <button type="button" className={styles.iconBtn} onClick={onClose} aria-label={t('close')}>
              <Icon name="close" />
            </button>
          </div>
          <div className={styles.panelBody}>{children}</div>
          {footer && <div className={styles.panelFoot}>{footer}</div>}
        </div>
      </div>
    </ModalPortal>
  );
}
