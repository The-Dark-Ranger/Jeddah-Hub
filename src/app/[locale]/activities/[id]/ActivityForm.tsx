'use client';

/* One of an activity's public forms (registration or after-event feedback).
 * Sent to /api/activities/respond, which checks it for bots, validates every
 * answer against this form's questions and saves it to activity_responses. */
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { getRecaptchaToken, preloadRecaptcha } from '@/lib/recaptcha';
import Honeypot from '@/components/Honeypot';
import type { CustomForm, FormType } from '@/lib/activityTypes';
import styles from './Activity.module.css';

interface Props {
  activityId: string;
  form: CustomForm;
  /** 'registration' before the event, 'feedback' after it. */
  formType: FormType;
}

/** One of an activity's public forms (registration or after-event).
 *  Submissions go to activity_responses tagged with `formType`; the
 *  curator's Activities dashboard reads them back per form. */
export default function ActivityForm({ activityId, form, formType }: Props) {
  const t = useTranslations('ActivityPage');
  const isFeedback = formType === 'feedback';
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [openedAt] = useState(() => Date.now());

  const askName = form.collectName ?? 'optional';
  const askEmail = form.collectEmail ?? 'optional';
  const questions = form.questions || [];
  const idPrefix = isFeedback ? 'fb' : 'reg';
  const setAnswer = (qid: string, value: string) => setAnswers(a => ({ ...a, [qid]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.closed) return;
    const missing = questions.find(q => {
      if (!q.required) return false;
      // A dropdown with no real options can never be answered: never let it block.
      if (q.type === 'select' && (q.options || []).filter(o => o.trim()).length === 0) return false;
      return !answers[q.id]?.trim();
    });
    if (missing) return setError(t('missingRequired', { field: missing.label }));
    if (askName === 'required' && !name.trim()) return setError(t('missingRequired', { field: t('yourName') }));
    if (askEmail === 'required' && !email.trim()) return setError(t('missingRequired', { field: t('yourEmail') }));
    setError('');
    setSubmitting(true);
    try {
      const recaptchaToken = await getRecaptchaToken('activity_form');
      const res = await fetch('/api/activities/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activityId, formType, answers, name: name.trim(), email: email.trim(),
          recaptchaToken, website: honeypot, elapsedMs: Date.now() - openedAt,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setSubmitted(true);
      } else {
        setError(
          data.error === 'missing' && data.field ? t('missingRequired', { field: data.field })
          : data.error === 'invalid_email' ? t('invalidEmailFormat')
          : data.error === 'closed' ? t('submitFailedPermission')
          : res.status === 429 ? t('tooManyAttempts')
          : data.error === 'bot_check_failed' ? t('verifyFailed')
          : t('submitFailed'),
        );
      }
    } catch {
      setError(t('submitFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  if (form.closed) {
    // A closed after-event form simply isn't shown (see ActivityClient).
    return (
      <div className={styles.closedBox}>
        <h2>{t('registrationClosedTitle')}</h2>
        <p>{t('registrationClosedBody')}</p>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className={styles.successBox}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="12" cy="12" r="10" /><polyline points="9 12 11 14 15 10" />
        </svg>
        <h2>{isFeedback ? t('fbThankYouTitle') : t('thankYouTitle')}</h2>
        <p>{form.successMessage?.trim() || (isFeedback ? t('fbThankYouBody') : t('thankYouBody'))}</p>
      </div>
    );
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} onFocus={preloadRecaptcha}>
      <Honeypot id={`${idPrefix}-website`} value={honeypot} onChange={setHoneypot} />
      {isFeedback && <span className={styles.formKicker}>{t('fbKicker')}</span>}
      <h2 className={styles.formTitle}>{isFeedback ? t('fbFormTitle') : t('formTitle')}</h2>
      {form.intro?.trim() && <p className={styles.formIntro}>{form.intro}</p>}

      {(askName !== 'off' || askEmail !== 'off') && (
        <div className={styles.formRow}>
          {askName !== 'off' && (
            <div className={styles.field}>
              <label className={styles.label} htmlFor={`${idPrefix}-name`}>{t('yourName')} {askName === 'required' && '*'}</label>
              <input id={`${idPrefix}-name`} className={styles.input} autoComplete="name" maxLength={200} required={askName === 'required'}
                value={name} onChange={e => setName(e.target.value)} placeholder={t('yourNamePh')} />
            </div>
          )}
          {askEmail !== 'off' && (
            <div className={styles.field}>
              <label className={styles.label} htmlFor={`${idPrefix}-email`}>{t('yourEmail')} {askEmail === 'required' && '*'}</label>
              <input id={`${idPrefix}-email`} className={styles.input} type="email" autoComplete="email" inputMode="email" maxLength={200} required={askEmail === 'required'}
                value={email} onChange={e => setEmail(e.target.value)} placeholder={t('yourEmailPh')} />
            </div>
          )}
        </div>
      )}

      {questions.map(q => {
        const fieldId = `${idPrefix}-${q.id}`;
        return (
          <div key={q.id} className={styles.field}>
            {q.type === 'rating' || q.type === 'checkbox'
              ? <span className={styles.label} id={fieldId}>{q.label} {q.required && '*'}</span>
              : <label className={styles.label} htmlFor={fieldId}>{q.label} {q.required && '*'}</label>}
            {q.type === 'text' && (
              <input id={fieldId} className={styles.input} value={answers[q.id] || ''} onChange={e => setAnswer(q.id, e.target.value)} required={q.required} maxLength={1000} />
            )}
            {q.type === 'textarea' && (
              <textarea id={fieldId} className={styles.textarea} rows={3} value={answers[q.id] || ''} onChange={e => setAnswer(q.id, e.target.value)} required={q.required} maxLength={4000} />
            )}
            {q.type === 'select' && (() => {
              const opts = (q.options || []).filter(o => o.trim());
              return (
                <select id={fieldId} className={styles.input} value={answers[q.id] || ''} onChange={e => setAnswer(q.id, e.target.value)} required={q.required && opts.length > 0} disabled={opts.length === 0}>
                  <option value="">{opts.length === 0 ? t('selectNoOptions') : t('selectPrompt')}</option>
                  {opts.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              );
            })()}
            {q.type === 'checkbox' && (
              <div className={styles.yesNoRow} role="radiogroup" aria-labelledby={fieldId}>
                {(['yes', 'no'] as const).map(v => (
                  <label key={v} className={styles.checkRow}>
                    <input type="radio" name={fieldId} checked={answers[q.id] === v} onChange={() => setAnswer(q.id, v)} required={q.required} />
                    {t(v)}
                  </label>
                ))}
              </div>
            )}
            {q.type === 'rating' && (
              <div className={styles.rating} role="radiogroup" aria-labelledby={fieldId}>
                {[1, 2, 3, 4, 5].map(n => {
                  const on = Number(answers[q.id] || 0) >= n;
                  return (
                    <button
                      key={n}
                      type="button"
                      role="radio"
                      aria-checked={answers[q.id] === String(n)}
                      aria-label={t('ratingOf', { n })}
                      className={styles.star + (on ? ' ' + styles.starOn : '')}
                      onClick={() => setAnswer(q.id, String(n))}
                    >
                      <svg width="30" height="30" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.4l-5.8 3.1 1.1-6.5L2.6 9.4l6.5-.9z" />
                      </svg>
                    </button>
                  );
                })}
                {answers[q.id] && <span className={styles.ratingValue} dir="ltr">{answers[q.id]} / 5</span>}
              </div>
            )}
          </div>
        );
      })}

      {error && <p className={styles.errorMsg} role="alert">{error}</p>}

      <button type="submit" className={styles.submitBtn} disabled={submitting}>
        {submitting ? t('submittingDots') : isFeedback ? t('fbSubmitBtn') : t('submitBtn')}
      </button>
    </form>
  );
}
