import styles from './JeddahStripe.module.css';
import Image from 'next/image';

interface JeddahStripeProps {
  className?: string;
}

export default function JeddahStripe({ className }: JeddahStripeProps) {
  return (
    <div className={[styles.stripe, className].filter(Boolean).join(' ')} aria-hidden="true">
      <Image
        src="/jeddah-stripe.png"
        alt=""
        fill
        sizes="100vw"
        className={styles.img}
        priority={false}
      />
    </div>
  );
}
