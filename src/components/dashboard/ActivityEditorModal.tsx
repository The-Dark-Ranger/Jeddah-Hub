'use client';

/* The Hub Activity editor window, shared by the curators' Hub Activities page
 * and members' My Hub Activities. It holds the form while it is open, checks
 * it, and hands the finished activity to the page, which decides what saving
 * means (a direct save, or a request for approval). */
import { useId, useState } from 'react';
import { useTranslations } from 'next-intl';
import ModalPortal from '@/components/ModalPortal';
import ActivityFormFields from '@/components/ActivityFormFields';
import { useBusy } from '@/components/dashboard/useBusy';
import { useDialog } from '@/components/dashboard/useDialog';
import { useSaveFailed } from '@/components/dashboard/useSaveFailed';
import {
  activityToForm, highlightsToText, parseHighlights, type ActivityFormData,
} from '@/lib/activityTypes';
import { clearDraft, readDraft, useDraftAutosave } from '@/lib/drafts';
import { safeExternalUrl, withHttps } from '@/lib/sanitize';
import { errorCode } from '@/lib/types';
import styles from '@/app/[locale]/dashboard/curator/activities/Activities.module.css';

interface Props {
  heading: string;
  submitLabel: string;
  initial: ActivityFormData;
  /** For a new proposal: the form is kept on this device until it is sent, so
   *  a reload or a closed window doesn't lose it. */
  draftKey?: string;
  /** Extra fields shown above the form. */
  children?: React.ReactNode;
  onClose: () => void;
  /** Throws if saving fails; the error is shown here and the form stays open. */
  onSubmit: (form: ActivityFormData) => Promise<void>;
}

interface EditorState { form: ActivityFormData; highlightsText: string }

export default function ActivityEditorModal({ heading, submitLabel, initial, draftKey, children, onClose, onSubmit }: Props) {
  const t = useTranslations('Dashboard');
  const headingId = useId();
  const saveFailed = useSaveFailed();
  const { run, isBusy } = useBusy();
  const saving = isBusy('save');

  const [start] = useState<EditorState>(() => ({ form: initial, highlightsText: highlightsToText(initial.highlights) }));
  const [restored, setRestored] = useState(() => (draftKey ? readDraft<EditorState>(draftKey) : null) !== null);
  const [form, setForm] = useState<ActivityFormData>(() => {
    const draft = draftKey ? readDraft<EditorState>(draftKey) : null;
    return draft ? activityToForm(draft.form) : start.form;
  });
  const [highlightsText, setHighlightsText] = useState(() => {
    const draft = draftKey ? readDraft<EditorState>(draftKey) : null;
    return draft ? draft.highlightsText : start.highlightsText;
  });
  const [error, setError] = useState('');

  const current = JSON.stringify({ form, highlightsText });
  const dirty = current !== JSON.stringify(start);
  useDraftAutosave(draftKey ?? null, { form, highlightsText }, !dirty);

  // Closing asks first only when something would actually be lost.
  const requestClose = () => {
    if (dirty && !draftKey && !confirm(t('confirmDiscardChanges'))) return;
    onClose();
  };
  const dialog = useDialog(true, requestClose);

  const discardDraft = () => {
    if (draftKey) clearDraft(draftKey);
    setForm(start.form);
    setHighlightsText(start.highlightsText);
    setRestored(false);
  };

  // One save at a time: a double click can't send the activity twice.
  const submit = () => {
    const typedUrl = form.ctaUrl.trim();
    const ctaUrl = typedUrl ? safeExternalUrl(withHttps(typedUrl)) : '';
    if (ctaUrl === undefined) { setError(t('activityCtaUrlInvalid')); return; }
    void run('save', async () => {
      setError('');
      try {
        await onSubmit({ ...form, title: form.title.trim(), ctaUrl, highlights: parseHighlights(highlightsText) });
        if (draftKey) clearDraft(draftKey);
      } catch (err) {
        console.error('Failed to save activity:', errorCode(err));
        setError(saveFailed(err));
      }
    });
  };

  return (
    <ModalPortal>
      <div className={styles.overlay} onMouseDown={e => { if (e.target === e.currentTarget) requestClose(); }}>
        <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby={headingId} tabIndex={-1} ref={dialog}>
          <div className={styles.modalHeader}>
            <h2 id={headingId}>{heading}</h2>
            <button type="button" className={styles.closeBtn} onClick={requestClose} aria-label={t('closeModal')}>✕</button>
          </div>

          <div className={styles.modalBody}>
            {restored && (
              <p className={styles.draftNote} role="status">
                {t('editorDraftRestored')}
                <button type="button" onClick={discardDraft}>{t('editorDraftDiscard')}</button>
              </p>
            )}
            {children}
            <ActivityFormFields form={form} setForm={setForm} highlightsText={highlightsText} setHighlightsText={setHighlightsText} />
          </div>

          <div className={styles.modalFooter}>
            {error && <p className={styles.modalError} role="alert">{error}</p>}
            <button type="button" className={styles.cancelBtn} onClick={requestClose}>{t('cancel')}</button>
            <button type="button" className={styles.saveBtn} onClick={submit} disabled={saving || !form.title.trim()}>
              {saving ? t('savingDots') : submitLabel}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
