'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { doc, getDoc, collection, addDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import WaveDivider from '@/components/WaveDivider';
import { slugify } from '@/lib/slug';
import { safeColor, type CustomForm } from '@/lib/activityTypes';
import InitiativeGallery from '@/components/InitiativeGallery';
import styles from './Activity.module.css';

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
  slug?: string;
}

/** `initial`: the activity loaded on the server (page.tsx), or null when
 *  none matches the URL; when absent it is fetched in the browser instead. */
export default function ActivityClient({ initial }: { initial?: Activity | null }) {
  const { id: rawId } = useParams() as { id: string };
  const t = useTranslations('ActivityPage');
  const router = useRouter();

  const [activity, setActivity] = useState<Activity | null | 'loading'>(initial === undefined ? 'loading' : initial);
  const [answers, setAnswers]   = useState<Record<string, string>>({});
  const [submitterName, setSubmitterName]   = useState('');
  const [submitterEmail, setSubmitterEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted]   = useState(false);
  const [error, setError]           = useState('');
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
          const match = allSnap.docs.find(d => slugify((d.data() as any).title || '') === rawId);
          if (match) data = { id: match.id, ...(match.data() as Omit<Activity, 'id'>) };
        }

        // Legacy: a bare doc-ID link from before this page had slugs at all.
        if (!data) {
          const legacySnap = await getDoc(doc(db, 'initiatives', rawId));
          if (legacySnap.exists() && (legacySnap.data() as any).type === 'hub_activity') {
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

  const setAnswer = (qid: string, value: string) => setAnswers(a => ({ ...a, [qid]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (activity === 'loading' || !activity) return;
    const questions = activity.customForm?.questions || [];
    const missing = questions.find(q => {
      if (!q.required) return false;
      // A select question with no real options can never be answered —
      // never let it block submission even if marked required.
      if (q.type === 'select' && (q.options || []).filter(o => o.trim()).length === 0) return false;
      return !answers[q.id]?.trim();
    });
    if (missing) {
      setError(t('missingRequired', { field: missing.label }));
      return;
    }
    const cf = activity.customForm;
    if (cf?.collectName === 'required' && !submitterName.trim()) {
      setError(t('missingRequired', { field: t('yourName') }));
      return;
    }
    if (cf?.collectEmail === 'required' && !submitterEmail.trim()) {
      setError(t('missingRequired', { field: t('yourEmail') }));
      return;
    }
    if (cf?.closed) return;
    setError('');
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        activityId: activity.id,
        answers,
        submittedAt: new Date().toISOString(),
        read: false,
      };
      if (submitterName.trim())  payload.submitterName  = submitterName.trim();
      if (submitterEmail.trim()) payload.submitterEmail = submitterEmail.trim();
      await addDoc(collection(db, 'activity_responses'), payload);
      setSubmitted(true);
    } catch (err: any) {
      console.error('Activity response submit failed:', err?.code || err);
      // permission-denied here almost always means the Firestore rules
      // this collection needs haven't been deployed yet (a config/ops gap,
      // not something the visitor can fix by retrying) — say so plainly
      // instead of a generic message that reads like a transient failure.
      setError(err?.code === 'permission-denied' ? t('submitFailedPermission') : t('submitFailed'));
    } finally {
      setSubmitting(false);
    }
  };

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
  const askName = cf?.collectName ?? 'optional';
  const askEmail = cf?.collectEmail ?? 'optional';
  // A form is worth showing if it asks anything at all — custom questions,
  // or just the registrant's name/email.
  const hasForm = !!cf?.enabled && ((cf.questions?.length ?? 0) > 0 || askName !== 'off' || askEmail !== 'off');
  const formOpen = hasForm && !cf?.closed;
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
            {formOpen && (
              <a href="#register" className={styles.ctaBtn}>{t('registerNow')}</a>
            )}
            {activity.ctaText && activity.ctaUrl && (
              <a
                href={activity.ctaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={formOpen ? styles.ctaBtnGhost : styles.ctaBtn}
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

      {hasForm && (
        <section className={styles.sectionAlt + ' ' + styles.registerSection} id="register">
          <div className={styles.containerNarrow}>
            {!formOpen ? (
              <div className={styles.closedBox}>
                <h2>{t('registrationClosedTitle')}</h2>
                <p>{t('registrationClosedBody')}</p>
              </div>
            ) : submitted ? (
              <div className={styles.successBox}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/><polyline points="9 12 11 14 15 10"/>
                </svg>
                <h2>{t('thankYouTitle')}</h2>
                <p>{cf?.successMessage?.trim() || t('thankYouBody')}</p>
              </div>
            ) : (
              <form className={styles.form} onSubmit={handleSubmit}>
                <h2 className={styles.formTitle}>{t('formTitle')}</h2>
                {cf?.intro?.trim() && <p className={styles.formIntro}>{cf.intro}</p>}

                {(askName !== 'off' || askEmail !== 'off') && (
                  <div className={styles.formRow}>
                    {askName !== 'off' && (
                      <div className={styles.field}>
                        <label className={styles.label} htmlFor="reg-name">{t('yourName')} {askName === 'required' && '*'}</label>
                        <input id="reg-name" className={styles.input} autoComplete="name" maxLength={200} required={askName === 'required'}
                          value={submitterName} onChange={e => setSubmitterName(e.target.value)} placeholder={t('yourNamePh')} />
                      </div>
                    )}
                    {askEmail !== 'off' && (
                      <div className={styles.field}>
                        <label className={styles.label} htmlFor="reg-email">{t('yourEmail')} {askEmail === 'required' && '*'}</label>
                        <input id="reg-email" className={styles.input} type="email" autoComplete="email" inputMode="email" maxLength={200} required={askEmail === 'required'}
                          value={submitterEmail} onChange={e => setSubmitterEmail(e.target.value)} placeholder={t('yourEmailPh')} />
                      </div>
                    )}
                  </div>
                )}

                {(cf?.questions || []).map(q => (
                  <div key={q.id} className={styles.field}>
                    <label className={styles.label}>{q.label} {q.required && '*'}</label>
                    {q.type === 'text' && (
                      <input className={styles.input} value={answers[q.id] || ''} onChange={e => setAnswer(q.id, e.target.value)} required={q.required} />
                    )}
                    {q.type === 'textarea' && (
                      <textarea className={styles.textarea} rows={3} value={answers[q.id] || ''} onChange={e => setAnswer(q.id, e.target.value)} required={q.required} />
                    )}
                    {q.type === 'select' && (() => {
                      const opts = (q.options || []).filter(o => o.trim());
                      return (
                        <select className={styles.input} value={answers[q.id] || ''} onChange={e => setAnswer(q.id, e.target.value)} required={q.required && opts.length > 0} disabled={opts.length === 0}>
                          <option value="">{opts.length === 0 ? t('selectNoOptions') : t('selectPrompt')}</option>
                          {opts.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      );
                    })()}
                    {q.type === 'checkbox' && (
                      <div className={styles.yesNoRow}>
                        <label className={styles.checkRow}>
                          <input
                            type="radio"
                            name={`q-${q.id}`}
                            checked={answers[q.id] === 'yes'}
                            onChange={() => setAnswer(q.id, 'yes')}
                            required={q.required}
                          />
                          {t('yes')}
                        </label>
                        <label className={styles.checkRow}>
                          <input
                            type="radio"
                            name={`q-${q.id}`}
                            checked={answers[q.id] === 'no'}
                            onChange={() => setAnswer(q.id, 'no')}
                            required={q.required}
                          />
                          {t('no')}
                        </label>
                      </div>
                    )}
                  </div>
                ))}

                {error && <p className={styles.errorMsg}>{error}</p>}

                <button type="submit" className={styles.submitBtn} disabled={submitting}>
                  {submitting ? t('submittingDots') : t('submitBtn')}
                </button>
              </form>
            )}
          </div>
        </section>
      )}
    </main>
  );
}
