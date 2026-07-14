import styles from './JeddahStripe.module.css';

interface JeddahStripeProps {
  variant?: 'blue' | 'white';
  className?: string;
}

export default function JeddahStripe({ variant = 'blue', className }: JeddahStripeProps) {
  return (
    <div
      className={[styles.stripe, variant === 'white' ? styles.stripeWhite : styles.stripeBlue, className].filter(Boolean).join(' ')}
      aria-hidden="true"
    >
      <svg
        className={styles.svg}
        viewBox="0 0 120 32"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern id="jeddah-tile" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
            {/* Eight-pointed star — classic Islamic geometric motif */}
            <rect width="20" height="20" fill="none" />
            {/* Central square rotated 45° */}
            <rect x="7.07" y="7.07" width="5.86" height="5.86" transform="rotate(45 10 10)" fill="currentColor" fillOpacity="0.18" />
            {/* Arms of the star */}
            <polygon points="10,2 11.2,7.5 10,6.5 8.8,7.5" fill="currentColor" fillOpacity="0.28" />
            <polygon points="10,18 11.2,12.5 10,13.5 8.8,12.5" fill="currentColor" fillOpacity="0.28" />
            <polygon points="2,10 7.5,11.2 6.5,10 7.5,8.8" fill="currentColor" fillOpacity="0.28" />
            <polygon points="18,10 12.5,11.2 13.5,10 12.5,8.8" fill="currentColor" fillOpacity="0.28" />
            {/* Corner diamonds */}
            <circle cx="0"  cy="0"  r="1.2" fill="currentColor" fillOpacity="0.14" />
            <circle cx="20" cy="0"  r="1.2" fill="currentColor" fillOpacity="0.14" />
            <circle cx="0"  cy="20" r="1.2" fill="currentColor" fillOpacity="0.14" />
            <circle cx="20" cy="20" r="1.2" fill="currentColor" fillOpacity="0.14" />
            {/* Mid-edge dots */}
            <circle cx="10" cy="0"  r="0.8" fill="currentColor" fillOpacity="0.2" />
            <circle cx="10" cy="20" r="0.8" fill="currentColor" fillOpacity="0.2" />
            <circle cx="0"  cy="10" r="0.8" fill="currentColor" fillOpacity="0.2" />
            <circle cx="20" cy="10" r="0.8" fill="currentColor" fillOpacity="0.2" />
            {/* Fine grid lines */}
            <line x1="0" y1="10" x2="20" y2="10" stroke="currentColor" strokeOpacity="0.08" strokeWidth="0.4" />
            <line x1="10" y1="0"  x2="10" y2="20" stroke="currentColor" strokeOpacity="0.08" strokeWidth="0.4" />
            <line x1="0"  y1="0"  x2="20" y2="20" stroke="currentColor" strokeOpacity="0.06" strokeWidth="0.4" />
            <line x1="20" y1="0"  x2="0"  y2="20" stroke="currentColor" strokeOpacity="0.06" strokeWidth="0.4" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#jeddah-tile)" />
      </svg>
    </div>
  );
}
