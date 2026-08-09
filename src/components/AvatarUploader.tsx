'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { compressToDataUrl, isDataUri, AVATAR_OPTIONS } from '@/lib/imageCompress';
import styles from './AvatarUploader.module.css';

interface Props {
  value: string;
  onChange: (value: string) => void;
}

/** Profile photo picker — shared by every role (shaper, lead, curator,
 *  vice curator, impact officer, alumni), which all use the same profile page.
 *  Images are centre-cropped square and compressed to a data URI so they need
 *  no external hosting. */
export default function AvatarUploader({ value, onChange }: Props) {
  const t = useTranslations('Dashboard');

  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy]     = useState(false);
  const [error, setError]   = useState('');
  const [broken, setBroken] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const stopDrag = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); };

  const handleFile = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true); setError('');
    try {
      onChange(await compressToDataUrl(files[0], { ...AVATAR_OPTIONS, square: true }));
      setBroken(false);
    } catch (err) {
      const code = err instanceof Error ? err.message : '';
      setError(
        code === 'not-an-image'  ? t('uploadNotAnImage')  :
        code === 'decode-failed' ? t('uploadDecodeFailed') :
        t('uploadFailed')
      );
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  return (
    <div className={styles.wrap}>
      <div
        className={styles.row + (dragOver ? ' ' + styles.rowDragOver : '')}
        onDragOver={e => { stopDrag(e); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { stopDrag(e); setDragOver(false); void handleFile(e.dataTransfer.files); }}
      >
        <div className={styles.avatar}>
          {value && !broken ? (
            <img src={value} alt="" className={styles.avatarImg} onError={() => setBroken(true)} loading="lazy" />
          ) : (
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <circle cx="12" cy="8" r="4"/>
              <path d="M4 20v-1a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v1"/>
            </svg>
          )}
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.uploadBtn}
            onClick={() => fileInput.current?.click()}
            disabled={busy}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            {busy ? t('uploadingPhotos') : dragOver ? t('dropHere') : value ? t('changePhoto') : t('uploadPhoto')}
          </button>

          {value && (
            <button type="button" className={styles.clearBtn} onClick={() => { onChange(''); setBroken(false); }}>
              {t('removePhoto')}
            </button>
          )}

          <p className={styles.hint}>{t('avatarHint')}</p>
        </div>
      </div>

      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        hidden
        onChange={e => void handleFile(e.target.files)}
      />

      {/* Existing profiles may hold a remote URL — keep that editable. */}
      <input
        className={styles.urlInput}
        value={isDataUri(value) ? '' : value}
        onChange={e => { onChange(e.target.value); setBroken(false); }}
        placeholder={t('orPasteUrl')}
        disabled={isDataUri(value)}
        type="url"
      />

      {broken && !!value && <p className={styles.error}>{t('avatarBrokenUrl')}</p>}
      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}
