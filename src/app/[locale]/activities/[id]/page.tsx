'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { doc, getDoc, collection, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useTranslations } from 'next-intl';
import WaveDivider from '@/components/WaveDivider';
import styles from './Activity.module.css';

interface Highlight { name: string; tag: string; }

interface CustomFormQuestion {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'checkbox';
  options?: string[];
  required: boolean;
}

interface Activity {
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
  type?: string;
  kind?: 'activity' | 'workshop';
  customForm?: { enabled: boolean; questions: CustomFormQuestion[] };
}

export default function ActivityPage() {
  const { id } = useParams() as { id: string };
  const t = useTranslations('ActivityPage');

  const [activity, setActivity] = useState<Activity | null | 'loading'>('loading');
  const [answers, setAnswers]   = useState<Record<string, string>>({});
  const [submitterName, setSubmitterName]   = useState('');
  const [submitterEmail, setSubmitterEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted]   = useState(false);
  const [error, setError]           = useState('');

  useEffect(() => {
    getDoc(doc(db, 'initiatives', id)).then(snap => {
      if (snap.exists() && (snap.data() as any).type === 'hub_activity') {
        setActivity({ id: snap.id, ...(snap.data() as Omit<Activity, 'id'>) });
      } else {
        setActivity(null);
      }
    }).catch(() => setActivity(null));
  }, [id]);

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

  if (activity === 'loading') return null;

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
  const hasForm = !!activity.customForm?.enabled && (activity.customForm?.questions?.length ?? 0) > 0;

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <div className={styles.badgeRow}>
            <span className={styles.kindBadge + ' ' + (activity.kind === 'workshop' ? styles.kindWorkshop : '')}>
              {activity.kind === 'workshop' ? t('kindWorkshop') : t('kindActivity')}
            </span>
            {activity.eyebrow && <p className={styles.eyebrow}>{activity.eyebrow}</p>}
          </div>
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
          {activity.ctaText && activity.ctaUrl && (
            <a
              href={activity.ctaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.ctaBtn}
              style={activity.color ? { background: activity.color, borderColor: activity.color } : undefined}
            >
              {activity.ctaText}
            </a>
          )}
        </div>
        <WaveDivider fill="var(--background)" className={styles.heroWave} />
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

      {hasForm && (
        <section className={styles.sectionAlt}>
          <div className={styles.containerNarrow}>
            {submitted ? (
              <div className={styles.successBox}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/><polyline points="9 12 11 14 15 10"/>
                </svg>
                <h2>{t('thankYouTitle')}</h2>
                <p>{t('thankYouBody')}</p>
              </div>
            ) : (
              <form className={styles.form} onSubmit={handleSubmit}>
                <h2 className={styles.formTitle}>{t('formTitle')}</h2>

                <div className={styles.formRow}>
                  <div className={styles.field}>
                    <label className={styles.label}>{t('yourName')}</label>
                    <input className={styles.input} value={submitterName} onChange={e => setSubmitterName(e.target.value)} placeholder={t('yourNamePh')} />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>{t('yourEmail')}</label>
                    <input className={styles.input} type="email" value={submitterEmail} onChange={e => setSubmitterEmail(e.target.value)} placeholder={t('yourEmailPh')} />
                  </div>
                </div>

                {activity.customForm!.questions.map(q => (
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
                      <label className={styles.checkRow}>
                        <input
                          type="checkbox"
                          checked={answers[q.id] === 'yes'}
                          onChange={e => setAnswer(q.id, e.target.checked ? 'yes' : 'no')}
                        />
                        {t('yes')}
                      </label>
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
