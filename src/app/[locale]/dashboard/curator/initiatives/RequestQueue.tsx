'use client';

/* One queue of requests waiting for a curator on the Initiatives page
 * (proposed initiatives, leave, removal and member-add requests): a titled
 * list with Approve and Decline on every row. Hidden while empty. */
import type { ReactNode } from 'react';
import styles from './Initiatives.module.css';

interface Props<T> {
  /** 'remove' when approving takes someone off a team (red Approve). */
  tone?: 'default' | 'remove';
  icon: ReactNode;
  title: string;
  items: T[];
  itemKey: (item: T) => string;
  name: (item: T) => ReactNode;
  meta: (item: T) => ReactNode;
  approveLabel: string;
  declineLabel: string;
  onApprove: (item: T) => void;
  onDecline: (item: T) => void;
}

export default function RequestQueue<T>({
  tone = 'default', icon, title, items, itemKey, name, meta,
  approveLabel, declineLabel, onApprove, onDecline,
}: Props<T>) {
  if (items.length === 0) return null;
  return (
    <section className={styles.queue + (tone === 'remove' ? ' ' + styles.queueRemove : '')}>
      <h3 className={styles.queueTitle}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">{icon}</svg>
        {title}
        <span className={styles.queueBadge}>{items.length}</span>
      </h3>
      <div className={styles.queueList}>
        {items.map(item => (
          <div key={itemKey(item)} className={styles.queueRow}>
            <div className={styles.queueInfo}>
              <span className={styles.queueName}>{name(item)}</span>
              <span className={styles.queueMeta}>{meta(item)}</span>
            </div>
            <div className={styles.queueActions}>
              <button type="button" className={styles.approveBtn} onClick={() => onApprove(item)}>{approveLabel}</button>
              <button type="button" className={styles.declineBtn} onClick={() => onDecline(item)}>{declineLabel}</button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
