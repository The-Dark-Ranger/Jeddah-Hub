'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  compressToDataUrl, totalBytes, byteSize, formatBytes, isDataUri,
  DOC_BUDGET_BYTES,
} from '@/lib/imageCompress';
import styles from './ImageUploader.module.css';

/* Matches the onChange(key, value) contract already used by every initiative
 * form, so this drops into the curator, lead, and impact officer editors. */
interface Props {
  coverUrl: string;
  /** Gallery photos, newline-joined — the shape formToDoc() already splits on. */
  photos: string;
  onChange: (key: 'imageUrl' | 'images', value: string) => void;
}

export default function ImageUploader({ coverUrl, photos, onChange }: Props) {
  const t = useTranslations('Dashboard');

  const coverInput   = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);

  const [busy, setBusy]   = useState(false);
  const [error, setError] = useState('');

  const photoList = photos.split('\n').map(s => s.trim()).filter(Boolean);

  // Remote URLs are just links; only inline data costs document space.
  const inlineCover  = isDataUri(coverUrl) ? coverUrl : '';
  const inlinePhotos = photoList.filter(isDataUri);
  const used         = totalBytes(inlineCover, inlinePhotos);
  const pct          = Math.min(100, Math.round((used / DOC_BUDGET_BYTES) * 100));

  const describeFailure = (err: unknown) => {
    const code = err instanceof Error ? err.message : '';
    if (code === 'not-an-image')  return t('uploadNotAnImage');
    if (code === 'decode-failed') return t('uploadDecodeFailed');
    return t('uploadFailed');
  };

  const handleCover = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true); setError('');
    try {
      const next = await compressToDataUrl(files[0]);
      // Replacing the cover frees whatever the previous one occupied.
      if (byteSize(next) + totalBytes('', inlinePhotos) > DOC_BUDGET_BYTES) {
        setError(t('uploadTooLarge'));
        return;
      }
      onChange('imageUrl', next);
    } catch (err) {
      setError(describeFailure(err));
    } finally {
      setBusy(false);
      if (coverInput.current) coverInput.current.value = '';
    }
  };

  const handleGallery = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true); setError('');

    const accepted: string[] = [];
    let running = used;
    let skipped = 0;

    for (const file of Array.from(files)) {
      try {
        const next = await compressToDataUrl(file);
        if (running + byteSize(next) > DOC_BUDGET_BYTES) { skipped++; continue; }
        accepted.push(next);
        running += byteSize(next);
      } catch (err) {
        setError(describeFailure(err));
      }
    }

    if (accepted.length) onChange('images', [...photoList, ...accepted].join('\n'));
    if (skipped) setError(t('uploadBudgetSkipped', { count: skipped }));

    setBusy(false);
    if (galleryInput.current) galleryInput.current.value = '';
  };

  const removePhoto = (idx: number) =>
    onChange('images', photoList.filter((_, i) => i !== idx).join('\n'));

  const label = (value: string) => isDataUri(value) ? t('uploadedLabel') : t('linkedLabel');

  return (
    <div className={styles.wrap}>

      {/* ── Cover photo ── */}
      <div className={styles.section}>
        <label className={styles.label}>{t('fieldCoverImage')}</label>

        {coverUrl ? (
          <div className={styles.coverPreview}>
            <img src={coverUrl} alt="" className={styles.coverImg} loading="lazy" />
            <span className={styles.originTag}>{label(coverUrl)}</span>
            <button
              type="button"
              className={styles.removeBtn}
              onClick={() => onChange('imageUrl', '')}
              aria-label={t('removePhoto')}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        ) : (
          <button
            type="button"
            className={styles.dropBtn}
            onClick={() => coverInput.current?.click()}
            disabled={busy}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
            {t('uploadCover')}
          </button>
        )}

        <input
          ref={coverInput}
          type="file"
          accept="image/*"
          hidden
          onChange={e => void handleCover(e.target.files)}
        />

        <input
          className={styles.urlInput}
          value={isDataUri(coverUrl) ? '' : coverUrl}
          onChange={e => onChange('imageUrl', e.target.value)}
          placeholder={t('orPasteUrl')}
          disabled={isDataUri(coverUrl)}
        />
      </div>

      {/* ── Gallery photos ── */}
      <div className={styles.section}>
        <label className={styles.label}>
          {t('fieldPhotos')}
          <span className={styles.hint}>{t('uploadPhotosHint')}</span>
        </label>

        {photoList.length > 0 && (
          <div className={styles.grid}>
            {photoList.map((src, i) => (
              <div key={i} className={styles.thumb}>
                <img src={src} alt="" className={styles.thumbImg} loading="lazy" />
                <button
                  type="button"
                  className={styles.removeBtn}
                  onClick={() => removePhoto(i)}
                  aria-label={t('removePhoto')}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          className={styles.addBtn}
          onClick={() => galleryInput.current?.click()}
          disabled={busy}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          {busy ? t('uploadingPhotos') : t('addPhotos')}
        </button>

        <input
          ref={galleryInput}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={e => void handleGallery(e.target.files)}
        />
      </div>

      {/* ── Budget meter ── */}
      <div className={styles.meterRow}>
        <div className={styles.meterTrack}>
          <div
            className={styles.meterFill}
            style={{ width: `${pct}%`, background: pct > 85 ? 'var(--danger)' : 'var(--primary-blue)' }}
          />
        </div>
        <span className={styles.meterText}>
          {formatBytes(used)} / {formatBytes(DOC_BUDGET_BYTES)}
        </span>
      </div>

      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}
