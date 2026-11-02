'use client';

/* The window a reviewer decides in: everything a proposal contains (or, for a
 * change to a live activity, only what would change), an optional note for
 * the sender, and Approve / Decline. */
import { useId, useState } from 'react';
import { useTranslations } from 'next-intl';
import ModalPortal from '@/components/ModalPortal';
import { safeColor, type CustomForm, type Highlight } from '@/lib/activityTypes';
import { errorCode } from '@/lib/types';
import styles from './Activities.module.css';

function ProposalFields({ fields }: { fields: Record<string, unknown> }) {
  const t = useTranslations('Dashboard');
  const row = (labelKey: Parameters<typeof t>[0], value: React.ReactNode) => (
    <div className={styles.detailRow}>
      <span className={styles.detailLabel}>{t(labelKey)}</span>
      <span className={styles.detailValue}>{value}</span>
    </div>
  );

  const highlights = fields.highlights as Highlight[] | undefined;
  const color = safeColor(fields.color);
  const imageUrl = typeof fields.imageUrl === 'string' ? fields.imageUrl : '';
  const images = Array.isArray(fields.images) ? (fields.images as unknown[]).filter((s): s is string => typeof s === 'string') : [];
  const forms = [['regTitle', fields.customForm], ['fbTitle', fields.feedbackForm]] as const;

  return (
    <>
      {typeof fields.title === 'string' && row('activityTitleLabel', fields.title)}
      {typeof fields.kind === 'string' && row('activityKindLabel', fields.kind === 'workshop' ? t('kindWorkshop') : t('kindActivity'))}
      {!!fields.eyebrow && row('activityEyebrowLabel', fields.eyebrow as string)}
      {!!fields.subtitle && row('activitySubtitleLabel', fields.subtitle as string)}
      {!!fields.description && row('activityDescLabel', fields.description as string)}
      {!!fields.date && row('activityDateLabel', fields.date as string)}
      {!!fields.location && row('activityLocationLabel', fields.location as string)}
      {!!fields.ctaText && row('activityCtaTextLabel', fields.ctaText as string)}
      {!!fields.ctaUrl && row('activityCtaUrlLabel', fields.ctaUrl as string)}
      {!!highlights?.length && row('activityHighlightsLabel',
        <ul className={styles.detailHighlightList}>
          {highlights.map((h, i) => <li key={i}>{h.name}{h.tag ? `: ${h.tag}` : ''}</li>)}
        </ul>
      )}
      {color && row('activityAccentColor',
        <span className={styles.detailColor}><span style={{ background: color }} />{color}</span>
      )}
      {(imageUrl || images.length > 0) && row('fieldPhotos',
        <span className={styles.detailPhotos}>
          {[imageUrl, ...images].filter(Boolean).slice(0, 12).map((src, i) => <img key={i} src={src} alt="" loading="lazy" />)}
        </span>
      )}
      {typeof fields.active === 'boolean' && row('activityActiveLabel', fields.active ? t('yes') : t('no'))}
      {typeof fields.archived === 'boolean' && row('filterArchived', fields.archived ? t('yes') : t('no'))}
      {forms.map(([label, value]) => {
        const f = value as CustomForm | undefined;
        if (!f) return null;
        return (
          <div key={label}>
            {row(label, !f.enabled ? t('no') : (
              <>
                {`${f.closed ? t('regClosed') : t('regOpen')} · ${t('customFormQuestionCount', { n: f.questions?.length || 0 })}`}
                {!!f.questions?.length && (
                  <ul className={styles.detailHighlightList}>
                    {f.questions.map(q => <li key={q.id}>{q.label}</li>)}
                  </ul>
                )}
              </>
            ))}
          </div>
        );
      })}
    </>
  );
}

interface Props {
  heading: string;
  /** Who sent it, what kind of request, which initiative. */
  details: { label: string; value: string }[];
  fields: Record<string, unknown>;
  /** A change to a live activity showing only what differs. */
  changesOnly?: boolean;
  /** False when this reviewer may read the request but not decide it. */
  canDecide: boolean;
  /** Offers the note to the sender (older proposals can't store one). */
  allowNote: boolean;
  onClose: () => void;
  /** Each throws if saving fails; the error is shown and the window stays open. */
  onApprove: (note: string) => Promise<void>;
  onDecline: (note: string) => Promise<void>;
}

export default function ActivityReview({ heading, details, fields, changesOnly, canDecide, allowNote, onClose, onApprove, onDecline }: Props) {
  const t = useTranslations('Dashboard');
  const headingId = useId();
  const noteId = useId();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const decide = async (action: (note: string) => Promise<void>) => {
    setBusy(true); setError('');
    try {
      await action(note.trim());
    } catch (err) {
      console.error('Failed to save the review:', err);
      setError(`${t('saveFailed')} (${errorCode(err) || 'unknown'})`);
      setBusy(false);
    }
  };

  return (
    <ModalPortal>
      <div className={styles.overlay} onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
        <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby={headingId}>
          <div className={styles.modalHeader}>
            <h2 id={headingId}>{heading}</h2>
            <button type="button" className={styles.closeBtn} onClick={onClose} aria-label={t('closeModal')}>✕</button>
          </div>
          <div className={styles.modalBody}>
            <div>
              {details.map(d => (
                <div key={d.label} className={styles.detailRow}>
                  <span className={styles.detailLabel}>{d.label}</span>
                  <span className={styles.detailValue}>{d.value}</span>
                </div>
              ))}
              {changesOnly && <h3 className={styles.detailHeading}>{t('reviewChangesOnly')}</h3>}
              {changesOnly && Object.keys(fields).length === 0 && <p className={styles.empty}>{t('reviewNoChanges')}</p>}
              <ProposalFields fields={fields} />
            </div>
            {canDecide && allowNote && (
              <div className={styles.field}>
                <label htmlFor={noteId} className={styles.label}>{t('reviewNoteField')}</label>
                <textarea id={noteId} className={styles.textarea} rows={2} maxLength={1000} value={note}
                  onChange={e => setNote(e.target.value)} placeholder={t('reviewNotePlaceholder')} />
              </div>
            )}
            {!canDecide && <p className={styles.queueHint}>{t('curatorOnlyApproval')}</p>}
          </div>
          <div className={styles.modalFooter}>
            {error && <p className={styles.modalError} role="alert">{error}</p>}
            <button type="button" className={styles.cancelBtn} onClick={onClose}>{t('closeModal')}</button>
            {canDecide && (
              <>
                <button type="button" className={styles.declineProposalBtn} disabled={busy} onClick={() => decide(onDecline)}>{t('declineProposal')}</button>
                <button type="button" className={styles.saveBtn} disabled={busy} onClick={() => decide(onApprove)}>{busy ? t('savingDots') : t('approveProposal')}</button>
              </>
            )}
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
