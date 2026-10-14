import styles from './DashSkeleton.module.css';

/** Placeholder rows shown while a dashboard page loads its data — keeps the
 *  page's shape stable instead of a lone "Loading…" line popping into a list. */
export default function DashSkeleton({ rows = 4, header = true, label }: { rows?: number; header?: boolean; label?: string }) {
  return (
    <div className={styles.wrap} role="status" aria-busy="true" aria-label={label}>
      {header && (
        <div className={styles.header}>
          <span className={styles.title} />
          <span className={styles.subtitle} />
        </div>
      )}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className={styles.row} style={{ animationDelay: `${i * 80}ms` }}>
          <span className={styles.avatar} />
          <span className={styles.lines}>
            <span className={styles.line} style={{ width: `${62 - (i % 3) * 12}%` }} />
            <span className={styles.lineShort} />
          </span>
          <span className={styles.pill} />
        </div>
      ))}
    </div>
  );
}
