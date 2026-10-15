'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  compressToDataUrl, totalBytes, byteSize, formatBytes, isDataUri,
  DOC_BUDGET_BYTES, MEDIA_OPTIONS,
} from '@/lib/imageCompress';
import { uploadMedia, isMediaUrl } from '@/lib/media';

/** Gallery size cap — generous, but keeps a page from becoming a photo dump. */
const MAX_PHOTOS = 24;
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
  const [coverDrag, setCoverDrag]     = useState(false);
  const [galleryDrag, setGalleryDrag] = useState(false);

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

  /** High quality into its own media document; if that write is refused
   *  (rules not deployed yet, offline…) fall back to a smaller inline copy
   *  that counts against the document's photo budget. */
  const storePhoto = async (file: File, inlineUsed: number): Promise<{ value: string; inlineBytes: number } | null> => {
    try {
      const url = await uploadMedia(await compressToDataUrl(file, MEDIA_OPTIONS));
      return { value: url, inlineBytes: 0 };
    } catch (err) {
      if (err instanceof Error && (err.message === 'not-an-image' || err.message === 'decode-failed')) throw err;
      const inline = await compressToDataUrl(file);
      if (inlineUsed + byteSize(inline) > DOC_BUDGET_BYTES) return null;
      return { value: inline, inlineBytes: byteSize(inline) };
    }
  };

  const handleCover = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true); setError('');
    try {
      // Replacing the cover frees whatever the previous one occupied.
      const stored = await storePhoto(files[0], totalBytes('', inlinePhotos));
      if (!stored) { setError(t('uploadTooLarge')); return; }
      onChange('imageUrl', stored.value);
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
      if (photoList.length + accepted.length >= MAX_PHOTOS) { skipped++; continue; }
      try {
        const stored = await storePhoto(file, running);
        if (!stored) { skipped++; continue; }
        accepted.push(stored.value);
        running += stored.inlineBytes;
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

  const label = (value: string) => isDataUri(value) || isMediaUrl(value) ? t('uploadedLabel') : t('linkedLabel');

  // Shared no-op-the-browser-default drag handlers — without preventDefault
  // on dragover, the browser refuses to fire drop at all.
  const stopDrag = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); };

  return (
    <div className={styles.wrap}>

      {/* ── Cover photo ── */}
      <div className={styles.section}>
        <label className={styles.label}>{t('fieldCoverImage')}</label>

        <div
          className={styles.dropZone + (coverDrag ? ' ' + styles.dropZoneActive : '')}
          onDragOver={e => { stopDrag(e); setCoverDrag(true); }}
          onDragLeave={() => setCoverDrag(false)}
          onDrop={e => { stopDrag(e); setCoverDrag(false); void handleCover(e.dataTransfer.files); }}
        >
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
              {coverDrag ? t('dropHere') : t('uploadCover')}
            </button>
          )}
        </div>

        <input
          ref={coverInput}
          type="file"
          accept="image/*"
          hidden
          onChange={e => void handleCover(e.target.files)}
        />

        <input
          className={styles.urlInput}
          value={isDataUri(coverUrl) || isMediaUrl(coverUrl) ? '' : coverUrl}
          onChange={e => onChange('imageUrl', e.target.value)}
          placeholder={t('orPasteUrl')}
          disabled={isDataUri(coverUrl) || isMediaUrl(coverUrl)}
        />
      </div>

      {/* ── Gallery photos ── */}
      <div className={styles.section}>
        <label className={styles.label}>
          {t('fieldPhotos')}
          <span className={styles.hint}>{t('uploadPhotosHint')}</span>
        </label>

        <div
          className={styles.dropZone + (galleryDrag ? ' ' + styles.dropZoneActive : '')}
          onDragOver={e => { stopDrag(e); setGalleryDrag(true); }}
          onDragLeave={() => setGalleryDrag(false)}
          onDrop={e => { stopDrag(e); setGalleryDrag(false); void handleGallery(e.dataTransfer.files); }}
        >
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
            {busy ? t('uploadingPhotos') : galleryDrag ? t('dropHere') : t('addPhotos')}
          </button>
        </div>

        <input
          ref={galleryInput}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={e => void handleGallery(e.target.files)}
        />
      </div>

      {/* ── Budget meter: only inline (fallback) photos use document space ── */}
      {used > 0 && <div className={styles.meterRow}>
        <div className={styles.meterTrack}>
          <div
            className={styles.meterFill}
            style={{ width: `${pct}%`, background: pct > 85 ? 'var(--danger)' : 'var(--primary-blue)' }}
          />
        </div>
        <span className={styles.meterText}>
          {formatBytes(used)} / {formatBytes(DOC_BUDGET_BYTES)}
        </span>
      </div>}

      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}
