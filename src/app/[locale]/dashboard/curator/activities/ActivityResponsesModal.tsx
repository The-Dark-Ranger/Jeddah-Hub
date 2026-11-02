'use client';

/* The window listing an activity's registration and after-event responses,
 * with the average of each star question and a spreadsheet download. Opening
 * it marks the responses as read. */
import { useEffect, useId, useState } from 'react';
import { collection, doc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { useLocale, useTranslations } from 'next-intl';
import { db } from '@/lib/firebase';
import ModalPortal from '@/components/ModalPortal';
import DashSkeleton from '@/components/dashboard/DashSkeleton';
import type { FormType, HubActivity } from '@/lib/activityTypes';
import styles from './Activities.module.css';
import { intlLocale } from '@/lib/dates';

interface ActivityResponse {
  id: string;
  activityId: string;
  answers: Record<string, string>;
  submittedAt: string;
  submitterName?: string;
  submitterEmail?: string;
  read?: boolean;
  /** Missing on responses sent before the after-event form existed. */
  formType?: FormType;
}

interface Props {
  activity: HubActivity;
  onClose: () => void;
  /** The activity's unread responses have just been read. */
  onRead: () => void;
}

export default function ActivityResponsesModal({ activity, onClose, onRead }: Props) {
  const t = useTranslations('Dashboard');
  const locale = useLocale();
  const headingId = useId();
  const [responses, setResponses] = useState<ActivityResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<FormType>(activity.customForm?.enabled ? 'registration' : 'feedback');
  const [downloadFailed, setDownloadFailed] = useState(false);

  useEffect(() => {
    let live = true;
    getDocs(query(collection(db, 'activity_responses'), where('activityId', '==', activity.id)))
      .then(snap => {
        if (!live) return;
        const docs = snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<ActivityResponse, 'id'>) }));
        setResponses(docs);
        const unread = docs.filter(r => r.read === false);
        if (unread.length > 0) {
          Promise.all(unread.map(r => updateDoc(doc(db, 'activity_responses', r.id), { read: true })))
            .catch(err => console.error('Failed to mark responses read:', err));
          onRead();
        }
      })
      .catch(err => console.error('Failed to load responses:', err))
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
    // Loads once per opened activity; onRead changes on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activity.id]);

  // Older responses without formType are registrations.
  const shown = responses.filter(r => (r.formType ?? 'registration') === tab);
  const questions = (tab === 'feedback' ? activity.feedbackForm : activity.customForm)?.questions || [];

  const download = async () => {
    setDownloadFailed(false);
    try {
      const { downloadActivityResponses } = await import('@/lib/exportActivityResponses');
      await downloadActivityResponses(activity.title, questions, shown, tab === 'feedback' ? 'Feedback' : 'Registrations');
    } catch (err) {
      console.error('Failed to build the spreadsheet:', err);
      setDownloadFailed(true);
    }
  };

  return (
    <ModalPortal>
      <div className={styles.overlay} onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
        <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby={headingId}>
          <div className={styles.modalHeader}>
            <h2 id={headingId}>{t('responsesFor')}: {activity.title}</h2>
            <button type="button" className={styles.closeBtn} onClick={onClose} aria-label={t('closeModal')}>✕</button>
          </div>
          <div className={styles.modalBody}>
            {activity.customForm?.enabled && activity.feedbackForm?.enabled && (
              <div className={styles.responseTabs} role="tablist">
                {(['registration', 'feedback'] as const).map(name => (
                  <button
                    key={name}
                    type="button"
                    role="tab"
                    aria-selected={tab === name}
                    className={styles.responseTab + (tab === name ? ' ' + styles.responseTabActive : '')}
                    onClick={() => setTab(name)}
                  >
                    {name === 'feedback' ? t('fbTitle') : t('regTitle')}
                    <span className={styles.responseTabCount}>
                      {responses.filter(r => (r.formType ?? 'registration') === name).length}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {loading ? (
              <DashSkeleton rows={3} header={false} label={t('loading')} />
            ) : shown.length === 0 ? (
              <p className={styles.empty}>{t('noResponsesYet')}</p>
            ) : (
              <>
                {/* Average of each star-rating question. */}
                {questions.filter(q => q.type === 'rating').map(q => {
                  const scores = shown.map(r => Number(r.answers?.[q.id])).filter(n => n >= 1 && n <= 5);
                  if (!scores.length) return null;
                  const avg = scores.reduce((x, y) => x + y, 0) / scores.length;
                  return (
                    <div key={q.id} className={styles.ratingSummary}>
                      <span className={styles.ratingSummaryScore}>★ {avg.toFixed(1)}</span>
                      <span>{q.label}</span>
                      <span className={styles.ratingSummaryCount}>{t('ratingCount', { n: scores.length })}</span>
                    </div>
                  );
                })}
                <div className={styles.responsesTableWrap}>
                  <table className={styles.responsesTable}>
                    <thead>
                      <tr>
                        <th>{t('submittedAtCol')}</th>
                        <th>{t('submitterNameCol')}</th>
                        <th>{t('submitterEmailCol')}</th>
                        {questions.map(q => <th key={q.id}>{q.label}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {shown.map(r => (
                        <tr key={r.id}>
                          <td>{new Date(r.submittedAt).toLocaleString(intlLocale(locale))}</td>
                          <td>{r.submitterName || ''}</td>
                          <td>{r.submitterEmail || ''}</td>
                          {questions.map(q => (
                            <td key={q.id}>
                              {q.type === 'rating' && r.answers?.[q.id] ? `★ ${r.answers[q.id]}` : r.answers?.[q.id] ?? ''}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
          <div className={styles.modalFooter}>
            {downloadFailed && <p className={styles.modalError} role="alert">{t('saveFailed')}</p>}
            <button type="button" className={styles.cancelBtn} onClick={onClose}>{t('closeModal')}</button>
            <button type="button" className={styles.saveBtn} onClick={download} disabled={shown.length === 0}>
              {t('downloadResponses')}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
