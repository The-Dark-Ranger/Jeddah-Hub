'use client';

import { useTranslations } from 'next-intl';
import ImageUploader from '@/components/ImageUploader';
import ColorPicker from '@/components/ColorPicker';
import { safeColor, type ActivityFormData } from '@/lib/activityTypes';
import styles from './ActivityAppearanceFields.module.css';

interface Props {
  form: ActivityFormData;
  setForm: (update: (f: ActivityFormData) => ActivityFormData) => void;
}

/** Cover photo, gallery and accent colour for a Hub Activity, with a live
 *  preview of how the homepage card will look. Shared by the curator's
 *  direct editor and the lead's request-for-approval editor. */
export default function ActivityAppearanceFields({ form, setForm }: Props) {
  const t = useTranslations('Dashboard');
  const accent = safeColor(form.color);

  const onImageChange = (key: 'imageUrl' | 'images', value: string) =>
    setForm(f => key === 'imageUrl'
      ? { ...f, imageUrl: value }
      : { ...f, images: value.split('\n').map(s => s.trim()).filter(Boolean) });

  return (
    <fieldset className={styles.fieldset}>
      <legend className={styles.legend}>{t('activityAppearance')}</legend>

      <div className={styles.grid}>
        <div className={styles.controls}>
          <ColorPicker
            label={t('activityAccentColor')}
            value={form.color}
            onChange={color => setForm(f => ({ ...f, color }))}
          />
          <ImageUploader coverUrl={form.imageUrl} photos={form.images.join('\n')} onChange={onImageChange} />
        </div>

        <div className={styles.previewCol} aria-hidden="true">
          <span className={styles.previewLabel}>{t('livePreview')}</span>
          <div
            className={styles.preview}
            style={accent ? { '--accent': accent } as React.CSSProperties : undefined}
          >
            <div className={styles.previewMedia}>
              {form.imageUrl
                ? <img src={form.imageUrl} alt="" className={styles.previewImg} />
                : <div className={styles.previewPattern} />}
              <span className={styles.previewKind}>
                {form.kind === 'workshop' ? t('kindWorkshop') : t('kindActivity')}
              </span>
            </div>
            <div className={styles.previewBody}>
              {form.eyebrow && <p className={styles.previewEyebrow}>{form.eyebrow}</p>}
              <p className={styles.previewTitle}>{form.title || t('activityTitlePh')}</p>
              {(form.date || form.location) && (
                <p className={styles.previewMeta}>{[form.date, form.location].filter(Boolean).join(' · ')}</p>
              )}
              <span className={styles.previewBtn}>{form.ctaText || t('viewDetails')}</span>
            </div>
          </div>
        </div>
      </div>
    </fieldset>
  );
}
