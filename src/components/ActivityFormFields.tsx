'use client';

/* The fields of the Hub Activity editor (text, appearance, dates, button,
 * highlights, visibility, and the registration and after-event forms).
 * Shared by the curator's direct editor and the lead's request editor. */
import { useTranslations } from 'next-intl';
import ActivityAppearanceFields from '@/components/ActivityAppearanceFields';
import RegistrationFormBuilder from '@/components/RegistrationFormBuilder';
import type { ActivityFormData, ActivityKind } from '@/lib/activityTypes';
import styles from '@/app/[locale]/dashboard/curator/activities/Activities.module.css';

interface Props {
  form: ActivityFormData;
  setForm: (update: (f: ActivityFormData) => ActivityFormData) => void;
  /** Highlights are edited as text, one per line, and parsed on save. */
  highlightsText: string;
  setHighlightsText: (text: string) => void;
}

export default function ActivityFormFields({ form, setForm, highlightsText, setHighlightsText }: Props) {
  const t = useTranslations('Dashboard');
  return (
    <>
      <div className={styles.formRow}>
        <div className={styles.field}>
          <label className={styles.label}>{t('activityTitleLabel')} *</label>
          <input className={styles.input} value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            placeholder={t('activityTitlePh')} />
        </div>
        <div className={styles.field}>
          <label className={styles.label}>{t('activityEyebrowLabel')}</label>
          <input className={styles.input} value={form.eyebrow}
            onChange={e => setForm(f => ({ ...f, eyebrow: e.target.value }))}
            placeholder={t('activityEyebrowPh')} />
        </div>
      </div>

      <div className={styles.field}>
        <label className={styles.label}>{t('activityKindLabel')}</label>
        <select
          className={styles.input}
          value={form.kind || 'activity'}
          onChange={e => setForm(f => ({ ...f, kind: e.target.value as ActivityKind }))}
        >
          <option value="activity">{t('kindActivity')}</option>
          <option value="workshop">{t('kindWorkshop')}</option>
        </select>
      </div>

      <div className={styles.field}>
        <label className={styles.label}>{t('activitySubtitleLabel')}</label>
        <input className={styles.input} value={form.subtitle}
          onChange={e => setForm(f => ({ ...f, subtitle: e.target.value }))}
          placeholder={t('activitySubtitlePh')} />
      </div>

      <div className={styles.field}>
        <label className={styles.label}>{t('activityDescLabel')}</label>
        <textarea className={styles.textarea} rows={3} value={form.description}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          placeholder={t('activityDescPh')} />
      </div>

      <ActivityAppearanceFields form={form} setForm={setForm} />

      <div className={styles.formRow}>
        <div className={styles.field}>
          <label className={styles.label}>{t('activityDateLabel')}</label>
          <input className={styles.input} value={form.date}
            onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
            placeholder={t('activityDatePh')} />
        </div>
        <div className={styles.field}>
          <label className={styles.label}>{t('activityLocationLabel')}</label>
          <input className={styles.input} value={form.location}
            onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
            placeholder={t('activityLocationPh')} />
        </div>
      </div>

      <div className={styles.formRow}>
        <div className={styles.field}>
          <label className={styles.label}>{t('activityCtaTextLabel')}</label>
          <input className={styles.input} value={form.ctaText}
            onChange={e => setForm(f => ({ ...f, ctaText: e.target.value }))}
            placeholder={t('activityCtaTextPh')} />
        </div>
        <div className={styles.field}>
          <label className={styles.label}>{t('activityCtaUrlLabel')}</label>
          <input className={styles.input} type="url" value={form.ctaUrl}
            onChange={e => setForm(f => ({ ...f, ctaUrl: e.target.value }))}
            placeholder={t('activityCtaUrlPh')} />
        </div>
      </div>

      <div className={styles.field}>
        <label className={styles.label}>{t('activityHighlightsLabel')}</label>
        <textarea className={styles.textarea} rows={4} value={highlightsText}
          onChange={e => setHighlightsText(e.target.value)}
          placeholder={t('activityHighlightsPh')} />
      </div>

      <label className={styles.checkRow}>
        <input type="checkbox" checked={form.active}
          onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} />
        {t('activityActiveLabel')}
      </label>

      <RegistrationFormBuilder
        value={form.customForm}
        onChange={customForm => setForm(f => ({ ...f, customForm }))}
      />
      <RegistrationFormBuilder
        variant="feedback"
        value={form.feedbackForm}
        onChange={feedbackForm => setForm(f => ({ ...f, feedbackForm }))}
      />
    </>
  );
}
