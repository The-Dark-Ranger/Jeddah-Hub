/* The banner at the top of the dashboard home and My Profile: the member's
 * photo (or initial) on a background in their role's colour, so both pages
 * share one look. */
import { roleStyle } from '@/lib/roleColors';
import styles from './RoleHero.module.css';

interface Props {
  role: string | null | undefined;
  photoURL?: string | null;
  /** Used for the initial when there is no photo. */
  name: string;
  /** Small line above the title (e.g. today's date). */
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  /** The title's heading level: h1 on the dashboard home, h2 elsewhere. */
  as?: 'h1' | 'h2';
  /** Lines under the title (role badge, email...). */
  children?: React.ReactNode;
}

export default function RoleHero({ role, photoURL, name, eyebrow, title, as: Heading = 'h2', children }: Props) {
  return (
    <div className={styles.hero} style={roleStyle(role)}>
      <span className={styles.ring1} aria-hidden="true" />
      <span className={styles.ring2} aria-hidden="true" />
      <div className={styles.avatar} aria-hidden="true">
        {photoURL
          ? <img src={photoURL} alt="" />
          : <span>{(name || '?').trim().charAt(0).toUpperCase()}</span>}
      </div>
      <div className={styles.text}>
        {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
        <Heading className={styles.title}>{title}</Heading>
        {children}
      </div>
    </div>
  );
}

/** A role (or other) pill for inside the banner. */
export function HeroBadge({ children }: { children: React.ReactNode }) {
  return <span className={styles.badge}>{children}</span>;
}

/** A muted line of text for inside the banner. */
export function HeroLine({ children }: { children: React.ReactNode }) {
  return <p className={styles.line}>{children}</p>;
}
