'use client';

import { useTranslations } from 'next-intl';
import ImageUploader from '@/components/ImageUploader';

export const CATEGORIES = [
  'Environment', 'Education', 'Health', 'Technology',
  'Arts & Culture', 'Economic Empowerment', 'Community', 'Wellbeing', 'Economy', 'Other',
];

/** Snaps free-text "Other" category input onto an existing canonical
 *  category (case-insensitively) so e.g. typing "economy" doesn't create a
 *  near-duplicate tab alongside the real "Economy" category — only text
 *  that doesn't match anything becomes a genuinely new category. */
function normalizeCategory(raw: string): string {
  const trimmed = raw.trim();
  const match = CATEGORIES.find(c => c !== 'Other' && c.toLowerCase() === trimmed.toLowerCase());
  return match || trimmed;
}

export const emptyInitiativeForm = {
  title: '', titleAr: '', description: '', descriptionAr: '',
  category: '', categoryOther: '', startDate: '', endDate: '',
  imageUrl: '', images: '', stat: '', problem: '', objective: '', impact: '',
  impactAreas: '', color: '',
};

export type InitiativeFormShape = typeof emptyInitiativeForm;

export function initiativeFormToDoc(f: InitiativeFormShape) {
  return {
    title:       f.title,
    titleAr:     f.titleAr || null,
    description: f.description,
    descriptionAr: f.descriptionAr || null,
    category:    f.category === 'Other' ? normalizeCategory(f.categoryOther) : f.category,
    startDate:   f.startDate,
    endDate:     f.endDate,
    imageUrl:    f.imageUrl,
    images:      f.images      ? f.images.split('\n').map(s => s.trim()).filter(Boolean) : [],
    stat:        f.stat,
    problem:     f.problem,
    objective:   f.objective,
    impact:      f.impact,
    impactAreas: f.impactAreas ? f.impactAreas.split(',').map(s => s.trim()).filter(Boolean) : [],
    color:       f.color || null,
  };
}

/** Reverses initiativeFormToDoc() for pre-filling the form from an existing
 *  initiative doc — used by every "edit" entry point (curator, lead). */
export function initiativeToForm(init: {
  title: string; titleAr?: string; description?: string; descriptionAr?: string;
  category?: string; startDate?: string; endDate?: string;
  imageUrl?: string; images?: string[]; stat?: string; problem?: string; objective?: string;
  impact?: string; impactAreas?: string[]; color?: string;
}): InitiativeFormShape {
  // A saved category that isn't one of the preset options only ever got
  // there via the "Other" free-text box — re-select "Other" and restore
  // what was typed, instead of silently falling back to no selection.
  const isPreset = !init.category || CATEGORIES.includes(init.category);
  return {
    title:       init.title,
    titleAr:     init.titleAr      || '',
    description: init.description  || '',
    descriptionAr: init.descriptionAr || '',
    category:      isPreset ? (init.category || '') : 'Other',
    categoryOther: isPreset ? '' : (init.category || ''),
    startDate:   init.startDate   || '',
    endDate:     init.endDate     || '',
    imageUrl:    init.imageUrl    || '',
    images:      (init.images     || []).join('\n'),
    stat:        init.stat        || '',
    problem:     init.problem     || '',
    objective:   init.objective   || '',
    impact:      init.impact      || '',
    impactAreas: (init.impactAreas || []).join(', '),
    color:       init.color        || '',
  };
}

interface Props {
  form: InitiativeFormShape;
  onChange: (key: keyof InitiativeFormShape, value: string) => void;
  /** CSS module supplying the shared field/input/label/etc. class names —
   *  every caller already has near-identical styles for these, passed in
   *  rather than duplicated here so this stays a plain shared component. */
  styles: Record<string, string>;
}

/** Shared by the curator's initiative create/edit modal and a lead's own
 *  edit modal — same fields, same capability, just different callers with
 *  different write targets (a real initiative doc vs a pending proposal). */
export default function InitiativeFormFields({ form, onChange, styles }: Props) {
  const t = useTranslations('Dashboard');
  const mk = (k: keyof InitiativeFormShape) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      onChange(k, e.target.value);

  return (
    <>
      <div className={styles.editRow}>
        <div className={styles.formField}>
          <label className={styles.label}>{t('fieldTitle')} *</label>
          <input className={styles.input} value={form.title} onChange={mk('title')} placeholder={t('phInitiativeName')} required />
        </div>
        <div className={styles.formField}>
          <label className={styles.label}>
            {t('fieldTitleAr')}
            <span className={styles.fieldHint}>{t('fieldArOptionalHint')}</span>
          </label>
          <input className={styles.input} dir="rtl" value={form.titleAr} onChange={mk('titleAr')} placeholder={t('phInitiativeNameAr')} />
        </div>
      </div>

      <div className={styles.editRow3}>
        <div className={styles.formField}>
          <label className={styles.label}>{t('fieldCategory')}</label>
          <select className={styles.input} value={form.category} onChange={mk('category')}>
            <option value="">{t('categorySelectPrompt')}</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          {form.category === 'Other' && (
            <input
              className={styles.input}
              style={{ marginTop: '.5rem' }}
              value={form.categoryOther}
              onChange={mk('categoryOther')}
              placeholder={t('phCategoryOther')}
            />
          )}
        </div>
        <div className={styles.formField}>
          <label className={styles.label}>{t('fieldStartDate')}</label>
          <input className={styles.input} type="date" value={form.startDate} onChange={mk('startDate')} />
        </div>
        <div className={styles.formField}>
          <label className={styles.label}>{t('fieldEndDate')}</label>
          <input className={styles.input} type="date" value={form.endDate} onChange={mk('endDate')} />
        </div>
      </div>

      <div className={styles.formField}>
        <label className={styles.label}>{t('fieldKeyStat')}</label>
        <input className={styles.input} value={form.stat} onChange={mk('stat')} placeholder={t('phStat')} />
      </div>

      <div className={styles.formField}>
        <label className={styles.label}>{t('fieldDescription')} *</label>
        <textarea className={styles.textarea} value={form.description} onChange={mk('description')} placeholder={t('phDescription')} required rows={2} />
      </div>

      <div className={styles.formField}>
        <label className={styles.label}>
          {t('fieldDescriptionAr')}
          <span className={styles.fieldHint}>{t('fieldArOptionalHint')}</span>
        </label>
        <textarea className={styles.textarea} dir="rtl" value={form.descriptionAr} onChange={mk('descriptionAr')} placeholder={t('phDescriptionAr')} rows={2} />
      </div>

      <div className={styles.formField}>
        <label className={styles.label}>{t('fieldProblem')}</label>
        <textarea className={styles.textarea} value={form.problem} onChange={mk('problem')} placeholder={t('phProblem')} rows={2} />
      </div>

      <div className={styles.formField}>
        <label className={styles.label}>{t('fieldObjective')}</label>
        <textarea className={styles.textarea} value={form.objective} onChange={mk('objective')} placeholder={t('phObjective')} rows={2} />
      </div>

      <div className={styles.formField}>
        <label className={styles.label}>{t('fieldImpact')}</label>
        <textarea className={styles.textarea} value={form.impact} onChange={mk('impact')} placeholder={t('phImpact')} rows={2} />
      </div>

      <div className={styles.editRow}>
        <div className={styles.formField}>
          <label className={styles.label}>
            {t('fieldImpactAreas')}
            <span className={styles.fieldHint}>{t('fieldImpactAreasHint')}</span>
          </label>
          <input className={styles.input} value={form.impactAreas} onChange={mk('impactAreas')} placeholder={t('phImpactAreas')} />
        </div>
        <div className={styles.formField}>
          <label className={styles.label}>{t('fieldThemeColor')}</label>
          <div className={styles.colorRow}>
            <input type="color" className={styles.colorInput} value={form.color || '#0F5A9F'} onChange={mk('color')} />
            <span className={styles.colorHex}>{form.color || t('fieldThemeColorNone')}</span>
            {form.color && (
              <button type="button" className={styles.colorClear} onClick={() => onChange('color', '')}>×</button>
            )}
          </div>
        </div>
      </div>

      <ImageUploader coverUrl={form.imageUrl} photos={form.images} onChange={onChange} />
    </>
  );
}
