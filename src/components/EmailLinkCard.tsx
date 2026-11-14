'use client';

/* The card behind a link in a newsletter email (confirming a subscription,
 * unsubscribing): one button, then the outcome. Nothing happens until the
 * button is pressed, because link scanners open every link in an email.
 * The link's id and token are sent to `endpoint`. */
import { useState, useSyncExternalStore } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import ThemeLogo from '@/components/ThemeLogo';
import styles from './EmailLinkCard.module.css';

type State = 'ready' | 'busy' | 'done' | 'invalid' | 'error';

const noSubscribe = () => () => {};
/** The link's id and token (only in the browser; the server sees no query). */
const readLink = () => {
  const q = new URLSearchParams(window.location.search);
  return `${q.get('id') ?? ''} ${q.get('t') ?? ''}`;
};

export default function EmailLinkCard({ namespace, endpoint }: {
  /** Messages with title, body, button, busy, doneTitle, done, invalid, error, home. */
  namespace: 'Unsubscribe' | 'NewsletterConfirm';
  endpoint: string;
}) {
  const t = useTranslations(namespace);
  const link = useSyncExternalStore<string | null>(noSubscribe, readLink, () => null);
  const [id, token] = (link ?? ' ').split(' ');
  const [state, setState] = useState<State>('ready');
  const hasLink = !!id && !!token;
  // Until the browser has read the link, assume it's fine (no error flash).
  const badLink = link !== null && !hasLink;

  const act = async () => {
    setState('busy');
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, t: token }),
      });
      setState(res.ok ? 'done' : res.status === 404 ? 'invalid' : 'error');
    } catch {
      setState('error');
    }
  };

  const message = badLink ? t('invalid') : state === 'done' ? t('done') : state === 'invalid' ? t('invalid') : t('body');
  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <ThemeLogo className={styles.logo} />
        <h1 className={styles.title}>{state === 'done' ? t('doneTitle') : t('title')}</h1>
        <p className={styles.text} role="status">{message}</p>
        {state === 'error' && <p className={styles.error} role="alert">{t('error')}</p>}
        {hasLink && (state === 'ready' || state === 'busy' || state === 'error') && (
          <button type="button" className={'btn-primary ' + styles.button} onClick={act} disabled={state === 'busy'}>
            {state === 'busy' ? t('busy') : t('button')}
          </button>
        )}
        <Link href="/" className={styles.home}>{t('home')}</Link>
      </div>
    </main>
  );
}
