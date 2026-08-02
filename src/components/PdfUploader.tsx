'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { uploadReportPdf, deleteReportPdf, MAX_PDF_BYTES, type PdfFile } from '@/lib/pdfUpload';
import styles from './PdfUploader.module.css';

interface Props {
  /** Stable id the file is stored under — allocated by the caller before the
   *  Firestore document exists, so the Storage path and doc id always match. */
  reportId: string;
  value: PdfFile | null;
  onChange: (file: PdfFile | null) => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function PdfUploader({ reportId, value, onChange }: Props) {
  const t = useTranslations('Dashboard');
  const fileInput = useRef<HTMLInputElement>(null);

  const [busy, setBusy]       = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError]     = useState('');
  const [dragOver, setDragOver] = useState(false);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setError('');
    if (file.type !== 'application/pdf') { setError(t('pdfWrongType')); return; }
    if (file.size > MAX_PDF_BYTES) { setError(t('pdfTooLarge')); return; }

    setBusy(true);
    setProgress(0);
    try {
      const uploaded = await uploadReportPdf(reportId, file, setProgress);
      onChange(uploaded);
    } catch {
      setError(t('pdfUploadFailed'));
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const handleRemove = async () => {
    if (!value) return;
    await deleteReportPdf(reportId, value.fileName);
    onChange(null);
  };

  return (
    <div className={styles.wrap}>
      {value ? (
        <div className={styles.fileCard}>
          <div className={styles.fileIcon}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
          </div>
          <div className={styles.fileInfo}>
            <span className={styles.fileName}>{value.fileName}</span>
            <span className={styles.fileMeta}>{formatBytes(value.fileSize)}</span>
          </div>
          <div className={styles.fileActions}>
            <a href={value.fileUrl} target="_blank" rel="noopener noreferrer" className={styles.viewBtn}>
              {t('pdfView')}
            </a>
            <button type="button" className={styles.replaceBtn} onClick={() => fileInput.current?.click()} disabled={busy}>
              {t('pdfReplace')}
            </button>
            <button type="button" className={styles.removeFileBtn} onClick={handleRemove} disabled={busy}>
              {t('remove')}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className={styles.dropZone + (dragOver ? ' ' + styles.dropZoneActive : '')}
          onClick={() => fileInput.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => {
            e.preventDefault();
            setDragOver(false);
            void handleFile(e.dataTransfer.files?.[0]);
          }}
          disabled={busy}
        >
          {busy ? (
            <div className={styles.progressWrap}>
              <div className={styles.progressTrack}>
                <div className={styles.progressFill} style={{ width: `${progress}%` }} />
              </div>
              <span className={styles.progressText}>{t('uploadingPdf')} {progress}%</span>
            </div>
          ) : (
            <>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              <span>{t('uploadPdf')}</span>
              <span className={styles.dropHint}>{t('pdfHint')}</span>
            </>
          )}
        </button>
      )}

      <input
        ref={fileInput}
        type="file"
        accept="application/pdf"
        hidden
        onChange={e => void handleFile(e.target.files?.[0])}
      />

      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}
