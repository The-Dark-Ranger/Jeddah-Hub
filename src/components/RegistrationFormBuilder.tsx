'use client';

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
}

type QType = CustomFormQuestion['type'];

const TYPE_ICONS: Record<QType, string> = {
  text: 'M4 7h16M4 12h10',
  textarea: 'M4 6h16M4 10h16M4 14h16M4 18h10',
  select: 'M4 6h16v12H4zM8 11l4 4 4-4',
  checkbox: 'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11',
};

/* Built-in name/email fields cycle off → optional → required. */
const NEXT_MODE: Record<ContactFieldMode, ContactFieldMode> = { off: 'optional', optional: 'required', required: 'off' };

/* A custom question that just re-asks for the name or email collected above. */
const NAME_RE = /\b(full\s*)?name\b|الاسم|اسمك/i;
const EMAIL_RE = /e-?mail|البريد/i;

/** Registration form editor shared by the curator's and a lead's activity
 *  editors. Only what the activity itself doesn't already say lives here:
 *  open/closed, which contact details to ask, the questions, and two
 *  optional messages. Titles and button text use the site's defaults. */
export default function RegistrationFormBuilder({ value, onChange }: Props) {
  const t = useTranslations('Dashboard');
  const uid = useId();
  const form = value;
  const questions = form.questions || [];
  const askName = form.collectName ?? 'optional';
  const askEmail = form.collectEmail ?? 'optional';

  const set = (patch: Partial<CustomForm>) => onChange({ ...form, ...patch });
  const setQuestions = (qs: CustomFormQuestion[]) => set({ questions: qs });
  const updateQuestion = (id: string, patch: Partial<CustomFormQuestion>) =>
    setQuestions(questions.map(q => (q.id === id ? { ...q, ...patch } : q)));

  const addQuestion = (type: QType) =>
    setQuestions([...questions, { id: newQuestionId(), label: '', type, options: type === 'select' ? [''] : [], required: false }]);
  const removeQuestion = (id: string) => setQuestions(questions.filter(q => q.id !== id));
  const duplicateQuestion = (q: CustomFormQuestion) => {
    const i = questions.findIndex(x => x.id === q.id);
    setQuestions([...questions.slice(0, i + 1), { ...q, id: newQuestionId(), options: [...(q.options || [])] }, ...questions.slice(i + 1)]);
  };
  const moveQuestion = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= questions.length) return;
    const next = [...questions];
    [next[i], next[j]] = [next[j], next[i]];
    setQuestions(next);
  };
  const setOptions = (q: CustomFormQuestion, options: string[]) => updateQuestion(q.id, { options });
  const changeType = (q: CustomFormQuestion, type: QType) =>
    updateQuestion(q.id, { type, options: type === 'select' && !(q.options || []).length ? [''] : q.options });

  const typeLabel: Record<QType, string> = {
    text: t('qTypeText'), textarea: t('qTypeTextarea'), select: t('qTypeSelect'), checkbox: t('qTypeCheckbox'),
  };
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
          <h3 id={uid + '-title'} className={styles.title}>{t('regTitle')}</h3>
          <p className={styles.sub}>{t('regSubtitle')}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={!!form.enabled}
          aria-labelledby={uid + '-title'}
          className={styles.switch + (form.enabled ? ' ' + styles.switchOn : '')}
          onClick={() => set({ enabled: !form.enabled })}
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
                  className={styles.segmentBtn + (!!form.closed === closed ? ' ' + styles.segmentOn : '')}
                  onClick={() => set({ closed })}
                >
                  {closed ? t('regClosed') : t('regOpen')}
                </button>
              ))}
            </div>
          </div>

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

          {/* ── Questions ── */}
          <div className={styles.questions}>
            {questions.length === 0 && <p className={styles.empty}>{t('regNoQuestions')}</p>}
            {questions.map((q, i) => {
              const repeats = (askName !== 'off' && NAME_RE.test(q.label)) || (askEmail !== 'off' && EMAIL_RE.test(q.label));
              return (
                <div key={q.id} className={styles.q}>
                  <div className={styles.qTop}>
                    <span className={styles.qIcon} title={typeLabel[q.type]} aria-hidden="true">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={TYPE_ICONS[q.type]} /></svg>
                    </span>
                    <input
                      className={styles.qLabel}
                      value={q.label}
                      onChange={e => updateQuestion(q.id, { label: e.target.value })}
                      placeholder={t('activityQuestionLabelPh')}
                      aria-label={`${t('activityQuestionLabelPh')} ${i + 1}`}
                      maxLength={200}
                    />
                  </div>

                  {repeats && <p className={styles.warn}>{t('regRepeatsWarning')}</p>}

                  {q.type === 'select' && (
                    <div className={styles.options}>
                      {(q.options || []).map((opt, idx) => (
                        <div key={idx} className={styles.option}>
                          <span className={styles.optionDot} aria-hidden="true" />
                          <input
                            className={styles.optionInput}
                            value={opt}
                            onChange={e => setOptions(q, (q.options || []).map((o, k) => (k === idx ? e.target.value : o)))}
                            placeholder={`${t('optionPlaceholder')} ${idx + 1}`}
                            maxLength={120}
                          />
                          <button type="button" className={styles.iconBtn} onClick={() => setOptions(q, (q.options || []).filter((_, k) => k !== idx))} aria-label={t('removeOption')}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
                          </button>
                        </div>
                      ))}
                      <button type="button" className={styles.linkBtn} onClick={() => setOptions(q, [...(q.options || []), ''])}>+ {t('addOption')}</button>
                      {(q.options || []).filter(o => o.trim()).length === 0 && (
                        <p className={styles.warn}>{t('activityQuestionNoOptionsWarning')}</p>
                      )}
                    </div>
                  )}

                  <div className={styles.qBottom}>
                    <select
                      className={styles.typeSelect}
                      value={q.type}
                      onChange={e => changeType(q, e.target.value as QType)}
                      aria-label={t('regQuestionType')}
                    >
                      {(Object.keys(typeLabel) as QType[]).map(k => <option key={k} value={k}>{typeLabel[k]}</option>)}
                    </select>
                    <label className={styles.req}>
                      <input type="checkbox" checked={q.required} onChange={e => updateQuestion(q.id, { required: e.target.checked })} />
                      {t('activityQuestionRequired')}
                    </label>
                    <span className={styles.tools}>
                      <button type="button" className={styles.iconBtn} onClick={() => moveQuestion(i, -1)} disabled={i === 0} aria-label={t('moveUp')} title={t('moveUp')}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><polyline points="18 15 12 9 6 15" /></svg>
                      </button>
                      <button type="button" className={styles.iconBtn} onClick={() => moveQuestion(i, 1)} disabled={i === questions.length - 1} aria-label={t('moveDown')} title={t('moveDown')}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><polyline points="6 9 12 15 18 9" /></svg>
                      </button>
                      <button type="button" className={styles.iconBtn} onClick={() => duplicateQuestion(q)} aria-label={t('duplicateQuestion')} title={t('duplicateQuestion')}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                      </button>
                      <button type="button" className={styles.iconBtn + ' ' + styles.danger} onClick={() => removeQuestion(q.id)} aria-label={t('removeQuestion')} title={t('removeQuestion')}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></svg>
                      </button>
                    </span>
                  </div>
                </div>
              );
            })}

            <div className={styles.addRow}>
              <span className={styles.rowLabel}>{t('addQuestion')}</span>
              {(Object.keys(typeLabel) as QType[]).map(k => (
                <button key={k} type="button" className={styles.addBtn} onClick={() => addQuestion(k)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={TYPE_ICONS[k]} /></svg>
                  {typeLabel[k]}
                </button>
              ))}
            </div>
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
