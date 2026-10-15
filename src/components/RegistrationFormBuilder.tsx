'use client';

import { useTranslations } from 'next-intl';
import {
  newQuestionId, FORM_TEXT_MAX,
  type CustomForm, type CustomFormQuestion, type ContactFieldMode,
} from '@/lib/activityTypes';
import styles from '@/app/[locale]/dashboard/curator/activities/Activities.module.css';
import own from './RegistrationFormBuilder.module.css';

interface Props {
  value: CustomForm;
  onChange: (next: CustomForm) => void;
}

/** The registration form editor shared by the curator's and a lead's
 *  activity editors: the form's frame (title, intro, button and thank-you
 *  text, contact fields, open/closed) plus its questions. */
export default function RegistrationFormBuilder({ value, onChange }: Props) {
  const t = useTranslations('Dashboard');
  const form = value;
  const questions = form.questions || [];

  const set = (patch: Partial<CustomForm>) => onChange({ ...form, ...patch });
  const setQuestions = (qs: CustomFormQuestion[]) => set({ questions: qs });
  const updateQuestion = (id: string, patch: Partial<CustomFormQuestion>) =>
    setQuestions(questions.map(q => (q.id === id ? { ...q, ...patch } : q)));

  const addQuestion = () =>
    setQuestions([...questions, { id: newQuestionId(), label: '', type: 'text', options: [], required: false }]);
  const removeQuestion = (id: string) => setQuestions(questions.filter(q => q.id !== id));
  const duplicateQuestion = (q: CustomFormQuestion) => {
    const i = questions.findIndex(x => x.id === q.id);
    const copy = { ...q, id: newQuestionId(), options: [...(q.options || [])] };
    setQuestions([...questions.slice(0, i + 1), copy, ...questions.slice(i + 1)]);
  };
  const moveQuestion = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= questions.length) return;
    const next = [...questions];
    [next[i], next[j]] = [next[j], next[i]];
    setQuestions(next);
  };

  /* Dropdown options are edited as individual rows (Google Forms style)
   * rather than one comma-separated field, where an option containing a
   * comma silently split in two. */
  const setOptions = (q: CustomFormQuestion, options: string[]) => updateQuestion(q.id, { options });
  const changeType = (q: CustomFormQuestion, type: CustomFormQuestion['type']) =>
    // Seed one empty option when switching to a dropdown so there's something to fill in.
    updateQuestion(q.id, { type, options: type === 'select' && !(q.options || []).length ? [''] : q.options });

  const modeSelect = (key: 'collectName' | 'collectEmail', label: string) => (
    <label className={own.modeField}>
      <span className={styles.label}>{label}</span>
      <select
        className={styles.input}
        value={form[key] ?? 'optional'}
        onChange={e => set({ [key]: e.target.value as ContactFieldMode })}
      >
        <option value="optional">{t('fieldModeOptional')}</option>
        <option value="required">{t('fieldModeRequired')}</option>
        <option value="off">{t('fieldModeOff')}</option>
      </select>
    </label>
  );

  return (
    <div className={styles.customFormSection}>
      <label className={styles.checkRow}>
        <input type="checkbox" checked={form.enabled ?? false} onChange={e => set({ enabled: e.target.checked })} />
        {t('activityCustomFormEnable')}
      </label>

      {form.enabled && (
        <>
          {/* ── The form's frame ── */}
          <fieldset className={own.frame}>
            <legend className={own.legend}>{t('formFrameTitle')}</legend>
            <p className={styles.customFormHint}>{t('formFrameHint')}</p>

            <div className={own.grid}>
              <label className={own.field}>
                <span className={styles.label}>{t('formTitleLabel')}</span>
                <input className={styles.input} value={form.title ?? ''} maxLength={FORM_TEXT_MAX.title}
                  onChange={e => set({ title: e.target.value })} placeholder={t('formTitlePh')} />
              </label>
              <label className={own.field}>
                <span className={styles.label}>{t('formSubmitLabel')}</span>
                <input className={styles.input} value={form.submitLabel ?? ''} maxLength={FORM_TEXT_MAX.submitLabel}
                  onChange={e => set({ submitLabel: e.target.value })} placeholder={t('formSubmitPh')} />
              </label>
            </div>

            <label className={own.field}>
              <span className={styles.label}>{t('formIntroLabel')}</span>
              <textarea className={styles.textarea} rows={2} value={form.intro ?? ''} maxLength={FORM_TEXT_MAX.intro}
                onChange={e => set({ intro: e.target.value })} placeholder={t('formIntroPh')} />
            </label>

            <div className={own.grid}>
              {modeSelect('collectName', t('formAskName'))}
              {modeSelect('collectEmail', t('formAskEmail'))}
            </div>

            <div className={own.grid}>
              <label className={own.field}>
                <span className={styles.label}>{t('formSuccessTitleLabel')}</span>
                <input className={styles.input} value={form.successTitle ?? ''} maxLength={FORM_TEXT_MAX.successTitle}
                  onChange={e => set({ successTitle: e.target.value })} placeholder={t('formSuccessTitlePh')} />
              </label>
              <label className={own.field}>
                <span className={styles.label}>{t('formSuccessMessageLabel')}</span>
                <input className={styles.input} value={form.successMessage ?? ''} maxLength={FORM_TEXT_MAX.successMessage}
                  onChange={e => set({ successMessage: e.target.value })} placeholder={t('formSuccessMessagePh')} />
              </label>
            </div>

            <label className={styles.checkRow + ' ' + own.closedRow}>
              <input type="checkbox" checked={!!form.closed} onChange={e => set({ closed: e.target.checked })} />
              <span>
                <strong>{t('formClosedLabel')}</strong>
                <span className={own.closedHint}>{t('formClosedHint')}</span>
              </span>
            </label>
          </fieldset>

          {/* ── Questions ── */}
          <div className={styles.questionList}>
            <p className={styles.customFormHint}>{t('activityCustomFormHint')}</p>
            {questions.map((q, i) => (
              <div key={q.id} className={styles.questionCard}>
                <div className={styles.questionHeader}>
                  <span className={styles.questionNum}>{i + 1}</span>
                  <input
                    className={styles.questionLabelInput}
                    value={q.label}
                    onChange={e => updateQuestion(q.id, { label: e.target.value })}
                    placeholder={t('activityQuestionLabelPh')}
                    aria-label={t('activityQuestionLabelPh')}
                  />
                  <select
                    className={styles.questionTypeSelect}
                    value={q.type}
                    onChange={e => changeType(q, e.target.value as CustomFormQuestion['type'])}
                  >
                    <option value="text">{t('qTypeText')}</option>
                    <option value="textarea">{t('qTypeTextarea')}</option>
                    <option value="select">{t('qTypeSelect')}</option>
                    <option value="checkbox">{t('qTypeCheckbox')}</option>
                  </select>
                </div>

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
                    <input type="checkbox" checked={q.required} onChange={e => updateQuestion(q.id, { required: e.target.checked })} />
                    {t('activityQuestionRequired')}
                  </label>
                  <div className={own.questionTools}>
                    <button type="button" className={own.toolBtn} onClick={() => moveQuestion(i, -1)} disabled={i === 0} aria-label={t('moveUp')} title={t('moveUp')}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><polyline points="18 15 12 9 6 15" /></svg>
                    </button>
                    <button type="button" className={own.toolBtn} onClick={() => moveQuestion(i, 1)} disabled={i === questions.length - 1} aria-label={t('moveDown')} title={t('moveDown')}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><polyline points="6 9 12 15 18 9" /></svg>
                    </button>
                    <button type="button" className={own.toolBtn} onClick={() => duplicateQuestion(q)} aria-label={t('duplicateQuestion')} title={t('duplicateQuestion')}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                    </button>
                    <button type="button" className={styles.removeQuestionBtn} onClick={() => removeQuestion(q.id)}>
                      {t('removeQuestion')}
                    </button>
                  </div>
                </div>
              </div>
            ))}
            <button type="button" className={styles.prefillBtn} onClick={addQuestion}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              {t('addQuestion')}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
