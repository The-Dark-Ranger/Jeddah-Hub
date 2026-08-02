'use client';

import { useState, useEffect } from 'react';
import {
  collection, getDocs, setDoc, updateDoc, deleteDoc, doc,
  query, orderBy, serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { useTranslations, useLocale } from 'next-intl';
import ModalPortal from '@/components/ModalPortal';
import PdfUploader from '@/components/PdfUploader';
import type { PdfFile } from '@/lib/pdfUpload';
import { deleteReportPdf } from '@/lib/pdfUpload';
import styles from './ImpactReports.module.css';

interface Report {
  id: string;
  title: string;
  initiativeId: string;
  initiativeTitle: string;
  summary: string;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  createdAt?: any;
}

interface InitiativeOption { id: string; title: string; }

const emptyForm = () => ({ title: '', initiativeId: '', summary: '' });

function formatBytes(bytes: number): string {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: any, locale: string): string {
  const d = value?.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function ImpactReportsPage() {
  const { user } = useAuth();
  const t = useTranslations('Dashboard');
  const locale = useLocale();

  const [reports, setReports]         = useState<Report[]>([]);
  const [initiatives, setInitiatives] = useState<InitiativeOption[]>([]);
  const [loading, setLoading]         = useState(true);
  const [modalOpen, setModalOpen]     = useState(false);
  const [editing, setEditing]         = useState<Report | null>(null);
  const [form, setForm]               = useState(emptyForm());
  const [pdf, setPdf]                 = useState<PdfFile | null>(null);
  /** Allocated the moment the modal opens, before any file is picked, so the
   *  Storage path is stable for both a brand-new report and one being
   *  re-edited. */
  const [reportId, setReportId]       = useState<string>('');
  const [saving, setSaving]           = useState(false);

  const role      = user?.role?.toLowerCase().replace(/\s+/g, '_') ?? '';
  const canManage = role === 'curator' || role === 'vice_curator' || role === 'impact_officer';

  async function fetchAll() {
    setLoading(true);
    try {
      const [reportSnap, initSnap] = await Promise.all([
        getDocs(query(collection(db, 'impact_reports'), orderBy('createdAt', 'desc'))),
        getDocs(collection(db, 'initiatives')),
      ]);
      setReports(reportSnap.docs.map(d => ({ id: d.id, ...d.data() } as Report)));
      setInitiatives(
        initSnap.docs
          .map(d => ({ id: d.id, title: (d.data() as any).title as string }))
          .filter(i => i.title)
      );
    } catch {
      setReports([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchAll(); }, []);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm());
    setPdf(null);
    setReportId(doc(collection(db, 'impact_reports')).id);
    setModalOpen(true);
  }

  function openEdit(r: Report) {
    setEditing(r);
    setForm({ title: r.title, initiativeId: r.initiativeId || '', summary: r.summary || '' });
    setPdf(r.fileUrl ? { fileUrl: r.fileUrl, fileName: r.fileName, fileSize: r.fileSize } : null);
    setReportId(r.id);
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.title.trim() || !pdf) return;
    setSaving(true);
    try {
      const initiativeTitle = initiatives.find(i => i.id === form.initiativeId)?.title || '';
      const payload = {
        title: form.title.trim(),
        initiativeId: form.initiativeId || null,
        initiativeTitle: initiativeTitle || null,
        summary: form.summary.trim(),
        fileUrl: pdf.fileUrl,
        fileName: pdf.fileName,
        fileSize: pdf.fileSize,
      };
      if (editing) {
        await updateDoc(doc(db, 'impact_reports', editing.id), { ...payload, updatedAt: serverTimestamp() });
      } else {
        // Written with the id already allocated in openCreate() — matches
        // the Storage path the PDF was uploaded to.
        await setDoc(doc(db, 'impact_reports', reportId), { ...payload, createdAt: serverTimestamp() });
      }
      setModalOpen(false);
      fetchAll();
    } catch (err: any) {
      alert(`${t('saveFailed')} ${err?.code || err?.message || ''}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(r: Report) {
    if (!confirm(t('deleteReportConfirm'))) return;
    try {
      if (r.fileName) await deleteReportPdf(r.id, r.fileName);
      await deleteDoc(doc(db, 'impact_reports', r.id));
      setReports(prev => prev.filter(x => x.id !== r.id));
    } catch (err: any) {
      alert(`${t('saveFailed')} ${err?.code || err?.message || ''}`);
    }
  }

  if (!canManage) {
    return <p style={{ padding: '2rem', color: 'var(--text-muted)' }}>{t('accessRestricted')}</p>;
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>{t('impactReports')}</h1>
          <p className={styles.subtitle}>{t('impactReportsSubtitle')}</p>
        </div>
        <button className={styles.newBtn} onClick={openCreate}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          {t('newReportBtn')}
        </button>
      </div>

      {loading ? (
        <p className={styles.empty}>{t('loading')}</p>
      ) : reports.length === 0 ? (
        <div className={styles.emptyState}>
          <p className={styles.emptyTitle}>{t('noReportsYet')}</p>
          <p className={styles.emptyDesc}>{t('createFirstReport')}</p>
        </div>
      ) : (
        <div className={styles.list}>
          {reports.map(r => (
            <div key={r.id} className={styles.card}>
              <div className={styles.cardIcon}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
              </div>
              <div className={styles.cardInfo}>
                <h2 className={styles.cardTitle}>{r.title}</h2>
                <p className={styles.cardMeta}>
                  {r.initiativeTitle && <span>{r.initiativeTitle}</span>}
                  {r.initiativeTitle && <span className={styles.cardMetaDot} />}
                  <span>{formatDate(r.createdAt, locale)}</span>
                  {r.fileSize > 0 && <span className={styles.cardMetaDot} />}
                  {r.fileSize > 0 && <span>{formatBytes(r.fileSize)}</span>}
                </p>
              </div>
              <div className={styles.cardActions}>
                {r.fileUrl && (
                  <a href={r.fileUrl} target="_blank" rel="noopener noreferrer" className={styles.viewBtn}>
                    {t('pdfView')}
                  </a>
                )}
                <button className={styles.editBtn} onClick={() => openEdit(r)}>{t('editLabel')}</button>
                <button className={styles.deleteBtn} onClick={() => handleDelete(r)}>{t('remove')}</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <ModalPortal>
        <div className={styles.overlay} onClick={() => setModalOpen(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>{editing ? t('editReport') : t('createReport')}</h2>
              <button className={styles.closeBtn} onClick={() => setModalOpen(false)}>✕</button>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.field}>
                <label className={styles.label}>{t('reportTitleLabel')} *</label>
                <input
                  className={styles.input}
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder={t('reportTitlePh')}
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label}>{t('reportInitiativeLabel')}</label>
                <select
                  className={styles.select}
                  value={form.initiativeId}
                  onChange={e => setForm(f => ({ ...f, initiativeId: e.target.value }))}
                >
                  <option value="">{t('reportInitiativeGeneral')}</option>
                  {initiatives.map(i => <option key={i.id} value={i.id}>{i.title}</option>)}
                </select>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>{t('reportSummaryLabel')}</label>
                <textarea
                  className={styles.textarea}
                  rows={3}
                  value={form.summary}
                  onChange={e => setForm(f => ({ ...f, summary: e.target.value }))}
                  placeholder={t('metricsPlaceholder')}
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label}>{t('reportPdfLabel')} *</label>
                <PdfUploader reportId={reportId} value={pdf} onChange={setPdf} />
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button className={styles.cancelBtn} onClick={() => setModalOpen(false)}>{t('cancel')}</button>
              <button className={styles.saveBtn} onClick={handleSave} disabled={saving || !form.title.trim() || !pdf}>
                {saving ? t('savingDots') : (editing ? t('saveChangesBtn') : t('createReport'))}
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}
    </div>
  );
}
