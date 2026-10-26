'use client';

/* Catches a crash in any public page: the navbar and footer stay, and the
 * page area shows the error panel with Try again / Reload. */
import ErrorPanel from '@/components/ErrorPanel';

export default function PageError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main id="main-content"><ErrorPanel error={error} reset={reset} /></main>;
}
