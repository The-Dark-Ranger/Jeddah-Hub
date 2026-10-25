'use client';

/* Form editor for an activity's registration and after-event forms. */
import { useId } from 'react';
import { useTranslations } from 'next-intl';
import {
  newQuestionId, FORM_TEXT_MAX,
  type CustomForm, type CustomFormQuestion, type ContactFieldMode,
} from '@/lib/activityTypes';
import styles from './RegistrationFormBuilder.module.css';

interface Props {
  value: CustomForm;
  onChange: (next: CustomForm) => void;
  /** 'feedback' edits the after-event form instead of registration: other
   *  wording, and turning it on adds three starter questions. */
  variant?: 'registration' | 'feedback';
}

type QType = CustomFormQuestion['type'];


/* Built-in name/email fields cycle off → optional → required. */
const NEXT_MODE: Record<ContactFieldMode, ContactFieldMode> = { off: 'optional', optional: 'required', required: 'off' };

/* A custom question that just re-asks for the name or email collected above. */
const NAME_RE = /\b(full\s*)?name\b|الاسم|اسمك/i;
const EMAIL_RE = /e-?mail|البريد/i;

/** Form editor shared by the curator's and a lead's activity editors, for
 *  both the registration form and the after-event (feedback) form. Only
 *  what the activity itself doesn't already say lives here: open/closed,
 *  which contact details to ask, the questions, and two optional messages.
 *  Titles and button text use the site's defaults. */
export default function RegistrationFormBuilder({ value, onChange, variant = 'registration' }: Props) {
  const t = useTranslations('Dashboard');
  const uid = useId();
  const form = value;
  const questions = form.questions || [];
  const askName = form.collectName ?? 'optional';
  const askEmail = form.collectEmail ?? 'optional';

  const isFeedback = variant === 'feedback';
  const set = (patch: Partial<CustomForm>) => onChange({ ...form, ...patch });

  // Turning the after-event form on for the first time starts it with the
  // usual three questions (a rating and two open ones), all editable.
  const toggleEnabled = () => {
    if (!form.enabled && isFeedback && questions.length === 0) {
      set({
        enabled: true,
        questions: [
          { id: newQuestionId(), label: t('fbStarterRating'), type: 'rating', options: [], required: true },
          { id: newQuestionId(), label: t('fbStarterBest'), type: 'textarea', options: [], required: false },
          { id: newQuestionId(), label: t('fbStarterImprove'), type: 'textarea', options: [], required: false },
        ],
      });
    } else {
      set({ enabled: !form.enabled });
    }
  };
  const setQuestions = (qs: CustomFormQuestion[]) => set({ questions: qs });
  const updateQuestion = (id: string, patch: Partial<CustomFormQuestion>) =>
    setQuestions(questions.map(q => (q.id === id ? { ...q, ...patch } : q)));

  const addQuestion = (type: QType) =>
    setQuestions([...questions, { id: newQuestionId(), label: '', type, options: type === 'select' ? [''] : [], required: false }]);
  const removeQuestion = (id: string) => setQuestions(questions.filter(q => q.id !== id));
  const setOptions = (q: CustomFormQuestion, options: string[]) => updateQuestion(q.id, { options });
  const changeType = (q: CustomFormQuestion, type: QType) =>
    updateQuestion(q.id, { type, options: type === 'select' && !(q.options || []).length ? [''] : q.options });

  const modeLabel: Record<ContactFieldMode, string> = {
    off: t('fieldModeOff'), optional: t('fieldModeOptional'), required: t('fieldModeRequired'),
  };

  // What a registrant will actually be asked, in one line.
  const asked = [
    askName !== 'off' && t('regName'),
    askEmail !== 'off' && t('regEmail'),
    questions.length > 0 && t('regQuestionsCount', { count: questions.length }),
  ].filter(Boolean) as string[];

  return (
    <section className={styles.wrap} aria-labelledby={uid + '-title'}>
      {/* ── On/off ── */}
      <div className={styles.head}>
        <div>
          <h3 id={uid + '-title'} className={styles.title}>{isFeedback ? t('fbTitle') : t('regTitle')}</h3>
          <p className={styles.sub}>{isFeedback ? t('fbSubtitle') : t('regSubtitle')}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={!!form.enabled}
          aria-labelledby={uid + '-title'}
          className={styles.switch + (form.enabled ? ' ' + styles.switchOn : '')}
          onClick={toggleEnabled}
        >
          <span className={styles.knob} />
        </button>
      </div>

      {form.enabled && (
        <div className={styles.body}>
          {/* ── Status + contact details ── */}
          <div className={styles.row}>
            <span className={styles.rowLabel}>{t('regStatus')}</span>
            <div className={styles.segment} role="radiogroup" aria-label={t('regStatus')}>
              {([false, true] as const).map(closed => (
                <button
                  key={String(closed)}
                  type="button"
                  role="radio"
                  aria-checked={!!form.closed === closed}
                  className={styles.segmentBtn + (!!form.closed === closed ? ' ' + (closed ? styles.segmentOnClosed : styles.segmentOn) : '')}
                  onClick={() => set({ closed })}
                >
                  {closed ? t('regClosed') : t('regOpen')}
                </button>
              ))}
            </div>
          </div>

          {form.closed && <p className={styles.closedNote}>{isFeedback ? t('fbClosedNote') : t('regClosedNote')}</p>}

          <div className={styles.row}>
            <span className={styles.rowLabel}>{t('regAskFor')}</span>
            <div className={styles.chips}>
              {([['collectName', askName, t('regName')], ['collectEmail', askEmail, t('regEmail')]] as const).map(([key, mode, label]) => (
                <button
                  key={key}
                  type="button"
                  className={styles.chip + ' ' + (styles['chip_' + mode] ?? '')}
                  onClick={() => set({ [key]: NEXT_MODE[mode] })}
                  title={t('regChipHint')}
                >
                  <span>{label}</span>
                  <span className={styles.chipMode}>{modeLabel[mode]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* ── Questions (the original question editor) ── */}
          <div className={styles.questionList}>
            <p className={styles.customFormHint}>{t('activityCustomFormHint')}</p>
            {questions.map((q, i) => {
              const repeats = (askName !== 'off' && NAME_RE.test(q.label)) || (askEmail !== 'off' && EMAIL_RE.test(q.label));
              return (
                <div key={q.id} className={styles.questionCard}>
                  <div className={styles.questionHeader}>
                    <span className={styles.questionNum}>{i + 1}</span>
                    <input
                      className={styles.questionLabelInput}
                      value={q.label}
                      onChange={e => updateQuestion(q.id, { label: e.target.value })}
                      placeholder={t('activityQuestionLabelPh')}
                      maxLength={200}
                    />
                    <select
                      className={styles.questionTypeSelect}
                      value={q.type}
                      onChange={e => changeType(q, e.target.value as QType)}
                    >
                      <option value="text">{t('qTypeText')}</option>
                      <option value="textarea">{t('qTypeTextarea')}</option>
                      <option value="select">{t('qTypeSelect')}</option>
                      <option value="checkbox">{t('qTypeCheckbox')}</option>
                      <option value="rating">{t('qTypeRating')}</option>
                    </select>
                  </div>

                  {repeats && <p className={styles.warn}>{t('regRepeatsWarning')}</p>}

                  {q.type === 'select' && (
                    <div className={styles.optionsList}>
                      {(q.options || []).filter(o => o.trim()).length === 0 && (
                        <p className={styles.optionsWarning}>{t('activityQuestionNoOptionsWarning')}</p>
                      )}
                      {(q.options || []).map((opt, idx) => (
                        <div key={idx} className={styles.optionRow}>
                          <span className={styles.optionBullet} aria-hidden="true" />
                          <input
                            className={styles.optionInput}
                            value={opt}
                            onChange={e => setOptions(q, (q.options || []).map((o, k) => (k === idx ? e.target.value : o)))}
                            placeholder={`${t('optionPlaceholder')} ${idx + 1}`}
                            maxLength={120}
                          />
                          <button
                            type="button"
                            className={styles.optionRemoveBtn}
                            onClick={() => setOptions(q, (q.options || []).filter((_, k) => k !== idx))}
                            aria-label={t('removeOption')}
                          >✕</button>
                        </div>
                      ))}
                      <button type="button" className={styles.addOptionBtn} onClick={() => setOptions(q, [...(q.options || []), ''])}>
                        + {t('addOption')}
                      </button>
                    </div>
                  )}

                  <div className={styles.questionFooter}>
                    <label className={styles.checkRow}>
                      <input
                        type="checkbox"
                        checked={q.required}
                        onChange={e => updateQuestion(q.id, { required: e.target.checked })}
                      />
                      {t('activityQuestionRequired')}
                    </label>
                    <button type="button" className={styles.removeQuestionBtn} onClick={() => removeQuestion(q.id)}>
                      {t('removeQuestion')}
                    </button>
                  </div>
                </div>
              );
            })}
            <button type="button" className={styles.addQuestionBtn} onClick={() => addQuestion('text')}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              {t('addQuestion')}
            </button>
          </div>

          {/* ── Optional messages ── */}
          <details className={styles.more}>
            <summary className={styles.moreSummary}>{t('regMoreOptions')}</summary>
            <div className={styles.moreBody}>
              <label className={styles.field}>
                <span className={styles.rowLabel}>{t('formIntroLabel')}</span>
                <textarea className={styles.textarea} rows={2} value={form.intro ?? ''} maxLength={FORM_TEXT_MAX.intro}
                  onChange={e => set({ intro: e.target.value })} placeholder={t('formIntroPh')} />
              </label>
              <label className={styles.field}>
                <span className={styles.rowLabel}>{t('formSuccessMessageLabel')}</span>
                <input className={styles.input} value={form.successMessage ?? ''} maxLength={FORM_TEXT_MAX.successMessage}
                  onChange={e => set({ successMessage: e.target.value })} placeholder={t('formSuccessMessagePh')} />
              </label>
            </div>
          </details>

          <p className={styles.summary}>
            {asked.length > 0 ? t('regSummary', { list: asked.join(' · ') }) : t('regSummaryNothing')}
          </p>
        </div>
      )}
    </section>
  );
}
