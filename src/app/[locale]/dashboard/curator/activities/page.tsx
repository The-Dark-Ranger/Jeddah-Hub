'use client';

import { useState, useEffect } from 'react';
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc, doc,
  query, serverTimestamp, where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { useTranslations } from 'next-intl';
import ModalPortal from '@/components/ModalPortal';
import styles from './Activities.module.css';

interface Highlight { name: string; tag: string; }

interface CustomFormQuestion {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'checkbox';
  options?: string[];
  required: boolean;
}

interface CustomForm {
  enabled: boolean;
  questions: CustomFormQuestion[];
}

type ActivityKind = 'activity' | 'workshop';

interface Activity {
  id: string;
  title: string;
  eyebrow: string;
  subtitle: string;
  description: string;
  date: string;
  location: string;
  ctaText: string;
  ctaUrl: string;
  highlights: Highlight[];
  active: boolean;
  kind?: ActivityKind;
  customForm?: CustomForm;
  createdAt?: any;
}

interface ActivityResponse {
  id: string;
  activityId: string;
  answers: Record<string, string>;
  submittedAt: string;
  submitterName?: string;
  submitterEmail?: string;
}

const emptyCustomForm = (): CustomForm => ({ enabled: false, questions: [] });

const emptyForm = (): Omit<Activity, 'id' | 'createdAt'> => ({
  title: '', eyebrow: '', subtitle: '', description: '',
  date: '', location: '', ctaText: '', ctaUrl: '',
  highlights: [], active: true, kind: 'activity', customForm: emptyCustomForm(),
});

function newQuestionId() {
  return `q_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

const RETREAT_PREFILL: Omit<Activity, 'id' | 'createdAt'> = {
  eyebrow: 'Annual Gathering',
  title: 'Jeddah Retreat 2026',
  subtitle: 'Where Cultures Meet',
  description: 'A 2.5-day cultural and connection-focused gathering hosted by the Jeddah Hub for Shapers from the Kingdom and around the world.',
  date: 'April 23–25, 2026',
  location: 'Jeddah, Saudi Arabia',
  ctaText: 'Explore the Retreat',
  ctaUrl: 'https://jeddahretreat.com',
  highlights: [
    { name: 'Al-Balad', tag: 'Heritage District' },
    { name: 'teamLab', tag: 'Immersive Art' },
    { name: 'Marbat Dhaban', tag: 'Coastal Experience' },
    { name: 'Corniche', tag: 'Waterfront' },
    { name: 'Red Sea Museum', tag: 'Museum' },
    { name: 'Taibat Alhijaz', tag: 'Restaurant' },
  ],
  active: true,
  kind: 'activity',
};

function parseHighlights(raw: string): Highlight[] {
  return raw
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
    .map(l => {
      const [name, ...rest] = l.split(',');
      return { name: name.trim(), tag: rest.join(',').trim() };
    });
}

function highlightsToText(hs: Highlight[]): string {
  return hs.map(h => `${h.name},${h.tag}`).join('\n');
}

export default function ActivitiesPage() {
  const { user } = useAuth();
  const t = useTranslations('Dashboard');

  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Activity | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [highlightsText, setHighlightsText] = useState('');
  const [saving, setSaving] = useState(false);

  /* Responses viewer */
  const [responsesFor, setResponsesFor] = useState<Activity | null>(null);
  const [responses, setResponses] = useState<ActivityResponse[]>([]);
  const [loadingResponses, setLoadingResponses] = useState(false);

  const role = user?.role?.toLowerCase().replace(/\s+/g, '_') ?? '';
  const canEdit = role === 'curator' || role === 'vice_curator';

  async function fetchAll() {
    setLoading(true);
    try {
      const snap = await getDocs(
        query(collection(db, 'initiatives'), where('type', '==', 'hub_activity'))
      );
      const sorted = snap.docs
        .map(d => ({ id: d.id, ...(d.data() as Omit<Activity, 'id'>) }))
        .sort((a, b) => {
          const ta = (a as any).createdAt?.toMillis?.() ?? 0;
          const tb = (b as any).createdAt?.toMillis?.() ?? 0;
          return tb - ta;
        });
      setActivities(sorted);
    } catch {
      setActivities([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchAll(); }, []);

  function openCreate(prefill?: Omit<Activity, 'id' | 'createdAt'>) {
    setEditing(null);
    // customForm/kind default here, not just in emptyForm(), because
    // RETREAT_PREFILL doesn't set them — leaving either undefined would
    // send an undefined field to Firestore on save, which the SDK rejects.
    const f = {
      ...(prefill ?? emptyForm()),
      kind: prefill?.kind || 'activity',
      customForm: prefill?.customForm || emptyCustomForm(),
    };
    setForm(f);
    setHighlightsText(highlightsToText(f.highlights || []));
    setModalOpen(true);
  }

  function openEdit(a: Activity) {
    setEditing(a);
    setForm({
      title: a.title, eyebrow: a.eyebrow, subtitle: a.subtitle,
      description: a.description, date: a.date, location: a.location,
      ctaText: a.ctaText, ctaUrl: a.ctaUrl, highlights: a.highlights, active: a.active,
      kind: a.kind || 'activity',
      customForm: a.customForm || emptyCustomForm(),
    });
    setHighlightsText(highlightsToText(a.highlights || []));
    setModalOpen(true);
  }

  /* ── Custom form question builder helpers ── */
  function addQuestion() {
    setForm(f => ({
      ...f,
      customForm: {
        enabled: f.customForm?.enabled ?? false,
        questions: [
          ...(f.customForm?.questions || []),
          { id: newQuestionId(), label: '', type: 'text', options: [], required: false },
        ],
      },
    }));
  }

  function updateQuestion(id: string, patch: Partial<CustomFormQuestion>) {
    setForm(f => ({
      ...f,
      customForm: {
        enabled: f.customForm?.enabled ?? false,
        questions: (f.customForm?.questions || []).map(q => q.id === id ? { ...q, ...patch } : q),
      },
    }));
  }

  function removeQuestion(id: string) {
    setForm(f => ({
      ...f,
      customForm: {
        enabled: f.customForm?.enabled ?? false,
        questions: (f.customForm?.questions || []).filter(q => q.id !== id),
      },
    }));
  }

  /* Dropdown-question options — edited as individual rows (Google Forms
   * style) rather than one comma-separated field, which was easy to mangle
   * (an option containing a comma silently split into two) and read as
   * "not working" even though it technically parsed. */
  function addOption(qId: string) {
    setForm(f => ({
      ...f,
      customForm: {
        enabled: f.customForm?.enabled ?? false,
        questions: (f.customForm?.questions || []).map(q =>
          q.id === qId ? { ...q, options: [...(q.options || []), ''] } : q
        ),
      },
    }));
  }

  function updateOption(qId: string, idx: number, value: string) {
    setForm(f => ({
      ...f,
      customForm: {
        enabled: f.customForm?.enabled ?? false,
        questions: (f.customForm?.questions || []).map(q =>
          q.id === qId ? { ...q, options: (q.options || []).map((o, i) => (i === idx ? value : o)) } : q
        ),
      },
    }));
  }

  function removeOption(qId: string, idx: number) {
    setForm(f => ({
      ...f,
      customForm: {
        enabled: f.customForm?.enabled ?? false,
        questions: (f.customForm?.questions || []).map(q =>
          q.id === qId ? { ...q, options: (q.options || []).filter((_, i) => i !== idx) } : q
        ),
      },
    }));
  }

  function changeQuestionType(qId: string, current: CustomFormQuestion, newType: CustomFormQuestion['type']) {
    // Seed one empty option automatically when switching into "Dropdown" —
    // an empty options list would otherwise render nothing to fill in.
    const options = newType === 'select' && !(current.options || []).length ? [''] : current.options;
    updateQuestion(qId, { type: newType, options });
  }

  async function handleSave() {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const payload = { ...form, highlights: parseHighlights(highlightsText), type: 'hub_activity' };
      if (editing) {
        await updateDoc(doc(db, 'initiatives', editing.id), { ...payload, updatedAt: serverTimestamp() });
      } else {
        await addDoc(collection(db, 'initiatives'), { ...payload, createdAt: serverTimestamp() });
      }
      setModalOpen(false);
      fetchAll();
    } catch (err: any) {
      console.error('Failed to save activity:', err);
      const code = err?.code || err?.message || 'unknown';
      alert(`Failed to save (${code}). If this says "permission-denied", ensure the Firestore rules have been deployed.`);
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(a: Activity) {
    try {
      await updateDoc(doc(db, 'initiatives', a.id), { active: !a.active });
      fetchAll();
    } catch (err) {
      console.error('Failed to toggle activity:', err);
      alert(t('saveFailed'));
    }
  }

  async function handleDelete(a: Activity) {
    if (!confirm(t('deleteActivityConfirm'))) return;
    try {
      await deleteDoc(doc(db, 'initiatives', a.id));
      fetchAll();
    } catch (err) {
      console.error('Failed to delete activity:', err);
      alert(t('saveFailed'));
    }
  }

  async function openResponses(a: Activity) {
    setResponsesFor(a);
    setLoadingResponses(true);
    try {
      const snap = await getDocs(query(collection(db, 'activity_responses'), where('activityId', '==', a.id)));
      setResponses(snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<ActivityResponse, 'id'>) })));
    } catch (err) {
      console.error('Failed to load responses:', err);
      setResponses([]);
    } finally {
      setLoadingResponses(false);
    }
  }

  function closeResponses() {
    setResponsesFor(null);
    setResponses([]);
  }

  async function handleDownloadResponses() {
    if (!responsesFor) return;
    const { downloadActivityResponses } = await import('@/lib/exportActivityResponses');
    downloadActivityResponses(responsesFor.title, responsesFor.customForm?.questions || [], responses);
  }

  if (!canEdit) {
    return <p style={{ padding: '2rem', color: 'var(--text-muted)' }}>{t('accessRestricted')}</p>;
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>{t('activitiesTitle')}</h1>
          <p className={styles.subtitle}>{t('activitiesSubtitle')}</p>
        </div>
        <button className={styles.newBtn} onClick={() => openCreate()}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          {t('newActivityBtn')}
        </button>
      </div>

      {loading ? (
        <p className={styles.empty}>{t('loading')}</p>
      ) : activities.length === 0 ? (
        <div className={styles.emptyState}>
          <p className={styles.emptyTitle}>{t('noActivities')}</p>
          <p className={styles.emptyDesc}>{t('createFirstActivity')}</p>
          <button className={styles.prefillBtn} onClick={() => openCreate(RETREAT_PREFILL)}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>
            </svg>
            {t('prefillRetreat')}
          </button>
        </div>
      ) : (
        <div className={styles.list}>
          {activities.map(a => (
            <div key={a.id} className={styles.card + (a.active ? ' ' + styles.cardActive : '')}>
              <div className={styles.cardTop}>
                <div className={styles.cardInfo}>
                  <div className={styles.cardBadgeRow}>
                    <span className={styles.kindBadge + ' ' + (a.kind === 'workshop' ? styles.kindWorkshop : styles.kindActivity)}>
                      {a.kind === 'workshop' ? t('kindWorkshop') : t('kindActivity')}
                    </span>
                    {a.eyebrow && <p className={styles.cardEyebrow}>{a.eyebrow}</p>}
                  </div>
                  <h2 className={styles.cardTitle}>{a.title}</h2>
                  {a.subtitle && <p className={styles.cardSubtitle}>{a.subtitle}</p>}
                  {(a.date || a.location) && (
                    <p className={styles.cardMeta}>{[a.date, a.location].filter(Boolean).join(' · ')}</p>
                  )}
                </div>
                <span className={styles.badge + ' ' + (a.active ? styles.badgeActive : styles.badgeInactive)}>
                  {a.active ? t('activityActive') : t('activityInactive')}
                </span>
              </div>
              {a.description && <p className={styles.cardDesc}>{a.description}</p>}
              <div className={styles.cardActions}>
                <button className={styles.editBtn} onClick={() => openEdit(a)}>{t('editActivity')}</button>
                {a.customForm?.enabled && (
                  <button className={styles.responsesBtn} onClick={() => openResponses(a)}>{t('viewResponses')}</button>
                )}
                <button
                  className={styles.toggleBtn + ' ' + (a.active ? styles.toggleOff : styles.toggleOn)}
                  onClick={() => handleToggleActive(a)}
                >
                  {a.active ? t('setHidden') : t('setActive')}
                </button>
                <button className={styles.deleteBtn} onClick={() => handleDelete(a)}>{t('deleteActivity')}</button>
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
              <h2>{editing ? t('editActivity') : t('createActivity')}</h2>
              <button className={styles.closeBtn} onClick={() => setModalOpen(false)}>✕</button>
            </div>

            <div className={styles.modalBody}>
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

              {/* ── Custom form builder ── */}
              <div className={styles.customFormSection}>
                <label className={styles.checkRow}>
                  <input type="checkbox" checked={form.customForm?.enabled ?? false}
                    onChange={e => setForm(f => ({
                      ...f,
                      customForm: { enabled: e.target.checked, questions: f.customForm?.questions || [] },
                    }))} />
                  {t('activityCustomFormEnable')}
                </label>

                {form.customForm?.enabled && (
                  <div className={styles.questionList}>
                    <p className={styles.customFormHint}>{t('activityCustomFormHint')}</p>
                    {(form.customForm.questions || []).map((q, i) => (
                      <div key={q.id} className={styles.questionCard}>
                        <div className={styles.questionHeader}>
                          <span className={styles.questionNum}>{i + 1}</span>
                          <input
                            className={styles.questionLabelInput}
                            value={q.label}
                            onChange={e => updateQuestion(q.id, { label: e.target.value })}
                            placeholder={t('activityQuestionLabelPh')}
                          />
                          <select
                            className={styles.questionTypeSelect}
                            value={q.type}
                            onChange={e => changeQuestionType(q.id, q, e.target.value as CustomFormQuestion['type'])}
                          >
                            <option value="text">{t('qTypeText')}</option>
                            <option value="textarea">{t('qTypeTextarea')}</option>
                            <option value="select">{t('qTypeSelect')}</option>
                            <option value="checkbox">{t('qTypeCheckbox')}</option>
                          </select>
                        </div>

                        {q.type === 'select' && (
                          <div className={styles.optionsList}>
                            {(q.options || []).map((opt, idx) => (
                              <div key={idx} className={styles.optionRow}>
                                <span className={styles.optionBullet} aria-hidden="true" />
                                <input
                                  className={styles.optionInput}
                                  value={opt}
                                  onChange={e => updateOption(q.id, idx, e.target.value)}
                                  placeholder={`${t('optionPlaceholder')} ${idx + 1}`}
                                />
                                <button
                                  type="button"
                                  className={styles.optionRemoveBtn}
                                  onClick={() => removeOption(q.id, idx)}
                                  aria-label={t('removeOption')}
                                >✕</button>
                              </div>
                            ))}
                            <button type="button" className={styles.addOptionBtn} onClick={() => addOption(q.id)}>
                              + {t('addOption')}
                            </button>
                          </div>
                        )}

                        <div className={styles.questionFooter}>
                          <label className={styles.checkRow}>
                            <input
                              type="checkbox"
                              checked={q.required}
                              onChange={e => updateQuestion(q.id, { required: e.target.checked })}
                            />
                            {t('activityQuestionRequired')}
                          </label>
                          <button type="button" className={styles.removeQuestionBtn} onClick={() => removeQuestion(q.id)}>
                            {t('removeQuestion')}
                          </button>
                        </div>
                      </div>
                    ))}
                    <button type="button" className={styles.prefillBtn} onClick={addQuestion}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                      </svg>
                      {t('addQuestion')}
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button className={styles.cancelBtn} onClick={() => setModalOpen(false)}>{t('cancel')}</button>
              <button className={styles.saveBtn} onClick={handleSave} disabled={saving || !form.title.trim()}>
                {saving ? t('savingDots') : (editing ? t('saveActivity') : t('createActivity'))}
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {responsesFor && (
        <ModalPortal>
        <div className={styles.overlay} onClick={closeResponses}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>{t('responsesFor')}: {responsesFor.title}</h2>
              <button className={styles.closeBtn} onClick={closeResponses}>✕</button>
            </div>
            <div className={styles.modalBody}>
              {loadingResponses ? (
                <p className={styles.empty}>{t('loading')}</p>
              ) : responses.length === 0 ? (
                <p className={styles.empty}>{t('noResponsesYet')}</p>
              ) : (
                <div className={styles.responsesTableWrap}>
                  <table className={styles.responsesTable}>
                    <thead>
                      <tr>
                        <th>{t('submittedAtCol')}</th>
                        {(responsesFor.customForm?.questions || []).map(q => (
                          <th key={q.id}>{q.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {responses.map(r => (
                        <tr key={r.id}>
                          <td>{new Date(r.submittedAt).toLocaleString()}</td>
                          {(responsesFor.customForm?.questions || []).map(q => (
                            <td key={q.id}>{r.answers?.[q.id] ?? ''}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.cancelBtn} onClick={closeResponses}>{t('cancel')}</button>
              <button
                className={styles.saveBtn}
                onClick={handleDownloadResponses}
                disabled={responses.length === 0}
              >
                {t('downloadResponses')}
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}
    </div>
  );
}
