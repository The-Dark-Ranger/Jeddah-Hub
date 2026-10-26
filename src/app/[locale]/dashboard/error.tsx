'use client';

/* Catches a crash in any dashboard page: the sidebar and navbar stay, and
 * only the page area shows the error panel with Try again / Reload. */
import ErrorPanel from '@/components/ErrorPanel';

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorPanel error={error} reset={reset} compact />;
}
