'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import WaveDivider from '@/components/WaveDivider';
import { slugify } from '@/lib/slug';
import { safeColor, type CustomForm } from '@/lib/activityTypes';
import InitiativeGallery from '@/components/InitiativeGallery';
import ActivityForm from './ActivityForm';
import styles from './Activity.module.css';
import { safeExternalUrl } from '@/lib/sanitize';

interface Highlight { name: string; tag: string; }

export interface Activity {
  id: string;
  title: string;
  eyebrow?: string;
  subtitle?: string;
  description?: string;
  date?: string;
  location?: string;
  ctaText?: string;
  ctaUrl?: string;
  highlights?: Highlight[];
  color?: string;
  imageUrl?: string;
  images?: string[];
  type?: string;
  kind?: 'activity' | 'workshop';
  customForm?: CustomForm;
  feedbackForm?: CustomForm;
  slug?: string;
}

/** `initial`: the activity loaded on the server (page.tsx), or null when
 *  none matches the URL; when absent it is fetched in the browser instead. */
export default function ActivityClient({ initial }: { initial?: Activity | null }) {
  const { id: rawId } = useParams() as { id: string };
  const t = useTranslations('ActivityPage');
  const router = useRouter();

  const [activity, setActivity] = useState<Activity | null | 'loading'>(initial === undefined ? 'loading' : initial);
  const [copied, setCopied]         = useState(false);

  useEffect(() => {
    if (initial !== undefined) {
      // Old bare-id / title-only links: switch to the clean URL.
      if (initial) {
        const canonical = initial.slug || slugify(initial.title);
        if (rawId !== canonical) router.replace(`/activities/${canonical}`);
      }
      return;
    }
    const load = async () => {
      try {
        let data: Activity | null = null;

        // Fast path: a matching `slug` field, scoped to Hub Activities.
        const slugSnap = await getDocs(query(
          collection(db, 'initiatives'), where('slug', '==', rawId), where('type', '==', 'hub_activity'),
        ));
        if (!slugSnap.empty) {
          const d = slugSnap.docs[0];
          data = { id: d.id, ...(d.data() as Omit<Activity, 'id'>) };
        }

        // Fallback: activities saved before the `slug` field existed —
        // match by computing the slug from the title on the fly.
        if (!data) {
          const allSnap = await getDocs(query(collection(db, 'initiatives'), where('type', '==', 'hub_activity')));
          const match = allSnap.docs.find(d => slugify(String(d.data().title || '')) === rawId);
          if (match) data = { id: match.id, ...(match.data() as Omit<Activity, 'id'>) };
        }

        // Legacy: a bare doc-ID link from before this page had slugs at all.
        if (!data) {
          const legacySnap = await getDoc(doc(db, 'initiatives', rawId));
          if (legacySnap.exists() && legacySnap.data().type === 'hub_activity') {
            data = { id: legacySnap.id, ...(legacySnap.data() as Omit<Activity, 'id'>) };
          }
        }

        if (data) {
          setActivity(data);
          const canonical = data.slug || slugify(data.title);
          if (rawId !== canonical) router.replace(`/activities/${canonical}`);
        } else {
          setActivity(null);
        }
      } catch {
        setActivity(null);
      }
    };
    load();
  }, [rawId, initial, router]);

  if (activity === 'loading') {
    return <div className={styles.loadingScreen}><div className={styles.spinner} /></div>;
  }

  if (!activity) {
    return (
      <main className={styles.page}>
        <div className={styles.notFound}>
          <h1>{t('notFound')}</h1>
        </div>
      </main>
    );
  }

  const hasHighlights = (activity.highlights?.length ?? 0) > 0;
  const cf = activity.customForm;
  // A form is worth showing if it asks anything at all: custom questions,
  // or just the person's name/email.
  const asksAnything = (f?: CustomForm) =>
    !!f?.enabled && ((f.questions?.length ?? 0) > 0 || (f.collectName ?? 'optional') !== 'off' || (f.collectEmail ?? 'optional') !== 'off');
  const hasForm = asksAnything(cf);
  const formOpen = hasForm && !cf?.closed;
  // The after-event form only appears once a curator opens it.
  const fb = activity.feedbackForm;
  const feedbackOpen = asksAnything(fb) && !fb?.closed;
  const mapsUrl = activity.location
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(activity.location)}`
    : '';
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard blocked */ }
  };
  const accent = safeColor(activity.color);
  const gallery = Array.isArray(activity.images) ? activity.images.filter(Boolean) : [];

  return (
    <main
      className={styles.page}
      style={accent ? { '--activity-accent': accent } as React.CSSProperties : undefined}
    >
      <section className={styles.hero + (activity.imageUrl ? ' ' + styles.heroWithImage : '')}>
        {activity.imageUrl && (
          <img src={activity.imageUrl} alt="" className={styles.heroImg} fetchPriority="high" />
        )}
        <div className={styles.heroContent}>
          {activity.eyebrow && <p className={styles.eyebrow}>{activity.eyebrow}</p>}
          <h1 className={styles.title}>{activity.title}</h1>
          {activity.subtitle && <p className={styles.subtitle}>{activity.subtitle}</p>}
          {activity.description && <p className={styles.description}>{activity.description}</p>}
          {(activity.date || activity.location) && (
            <div className={styles.meta}>
              {activity.date && <span>{activity.date}</span>}
              {activity.date && activity.location && <span className={styles.metaDot} />}
              {activity.location && <span>{activity.location}</span>}
            </div>
          )}
          <div className={styles.heroActions}>
            {feedbackOpen && (
              <a href="#feedback" className={styles.ctaBtn}>{t('fbCta')}</a>
            )}
            {formOpen && (
              <a href="#register" className={feedbackOpen ? styles.ctaBtnGhost : styles.ctaBtn}>{t('registerNow')}</a>
            )}
            {activity.ctaText && safeExternalUrl(activity.ctaUrl) && (
              <a
                href={safeExternalUrl(activity.ctaUrl)}
                target="_blank"
                rel="noopener noreferrer"
                className={formOpen || feedbackOpen ? styles.ctaBtnGhost : styles.ctaBtn}
              >
                {activity.ctaText}
              </a>
            )}
          </div>
        </div>
        <WaveDivider fill="var(--background)" className={styles.heroWave} />
      </section>

      {/* At-a-glance details */}
      <section className={styles.factsSection}>
        <div className={styles.container}>
          <dl className={styles.facts}>
            <div className={styles.fact}>
              <dt>{t('factType')}</dt>
              <dd>{activity.kind === 'workshop' ? t('kindWorkshop') : t('kindActivity')}</dd>
            </div>
            {activity.date && (
              <div className={styles.fact}>
                <dt>{t('factDate')}</dt>
                <dd>{activity.date}</dd>
              </div>
            )}
            {activity.location && (
              <div className={styles.fact}>
                <dt>{t('factLocation')}</dt>
                <dd>
                  <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className={styles.factLink}>
                    {activity.location}
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9" /></svg>
                  </a>
                </dd>
              </div>
            )}
            {hasForm && (
              <div className={styles.fact}>
                <dt>{t('factRegistration')}</dt>
                <dd>
                  <span className={styles.statusDot + (formOpen ? ' ' + styles.statusOpen : '')} aria-hidden="true" />
                  {formOpen ? t('registrationOpen') : t('registrationClosed')}
                </dd>
              </div>
            )}
          </dl>
          <button type="button" className={styles.shareBtn} onClick={copyLink}>
            {copied ? t('linkCopied') : t('shareActivity')}
          </button>
        </div>
      </section>

      {hasHighlights && (
        <section className={styles.section}>
          <div className={styles.container}>
            <div className={styles.highlightsGrid}>
              {activity.highlights!.map(h => (
                <div key={h.name} className={styles.highlightCard}>
                  <div className={styles.highlightName}>{h.name}</div>
                  <div className={styles.highlightTag}>{h.tag}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {gallery.length > 0 && (
        <section className={styles.section}>
          <div className={styles.container}>
            <InitiativeGallery photos={[activity.imageUrl, ...gallery].filter((s): s is string => !!s)} title={activity.title} accent={accent} />
          </div>
        </section>
      )}

      {feedbackOpen && fb && (
        <section className={styles.sectionAlt + ' ' + styles.registerSection + ' ' + styles.feedbackSection} id="feedback">
          <div className={styles.containerNarrow}>
            <ActivityForm activityId={activity.id} form={fb} formType="feedback" />
          </div>
        </section>
      )}

      {hasForm && cf && (
        <section className={styles.sectionAlt + ' ' + styles.registerSection} id="register">
          <div className={styles.containerNarrow}>
            <ActivityForm activityId={activity.id} form={cf} formType="registration" />
          </div>
        </section>
      )}
    </main>
  );
}
