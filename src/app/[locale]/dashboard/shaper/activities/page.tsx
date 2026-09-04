'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  collection, getDocs, addDoc, deleteDoc, doc,
  query, where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { useTranslations } from 'next-intl';
import ModalPortal from '@/components/ModalPortal';
import {
  type ActivityFormData, type CustomFormQuestion,
  emptyCustomForm, emptyActivityForm, newQuestionId, parseHighlights, highlightsToText,
} from '@/lib/activityTypes';
// Same page structure/classes as the curator's Activities dashboard — a
// second lead-facing copy of ~250 lines of layout/form CSS would just be
// this file's styles going stale the next time that one changes.
import styles from '../../curator/activities/Activities.module.css';

interface Activity extends ActivityFormData {
  id: string;
  archived?: boolean;
  initiativeId?: string;
}

interface ChangeRequest {
  id: string;
  changeType: 'create' | 'update';
  activityId: string | null;
  initiativeId: string;
  activityTitle: string;
  status: 'pending' | 'approved' | 'declined';
}

interface LedInitiative { id: string; title: string; }

export default function LeadActivitiesPage() {
  const { user } = useAuth();
  const t = useTranslations('Dashboard');

  const [ledInitiatives, setLedInitiatives] = useState<LedInitiative[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [pendingRequests, setPendingRequests] = useState<ChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Activity | null>(null);
  const [form, setForm] = useState(emptyActivityForm());
  const [formInitiativeId, setFormInitiativeId] = useState('');
  const [highlightsText, setHighlightsText] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    try {
      const ledSnap = await getDocs(query(collection(db, 'initiatives'), where('leads', 'array-contains', user.uid)));
      const led = ledSnap.docs
        .filter(d => !(d.data() as Record<string, unknown>).type) // real initiatives only, not other leads' hub_activity docs
        .map(d => ({ id: d.id, title: (d.data() as Record<string, unknown>).title as string }));
      setLedInitiatives(led);

      if (led.length > 0) {
        const ledIds = new Set(led.map(l => l.id));
        const [activitySnap, requestSnap] = await Promise.all([
          getDocs(query(collection(db, 'initiatives'), where('type', '==', 'hub_activity'))),
          getDocs(query(collection(db, 'activity_change_requests'), where('proposedBy', '==', user.uid), where('status', '==', 'pending'))),
        ]);
        const mine = activitySnap.docs
          .map(d => ({ id: d.id, ...(d.data() as Omit<Activity, 'id'>) }))
          .filter(a => a.initiativeId && ledIds.has(a.initiativeId));
        setActivities(mine);
        setPendingRequests(requestSnap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<ChangeRequest, 'id'>) })));
      } else {
        setActivities([]);
        setPendingRequests([]);
      }
    } catch (err) {
      console.error('Failed to load lead activities:', err);
      setActivities([]);
      setPendingRequests([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const pendingForActivity = (activityId: string) => pendingRequests.find(r => r.activityId === activityId);

  function openCreate() {
    setEditing(null);
    setForm(emptyActivityForm());
    setFormInitiativeId(ledInitiatives[0]?.id || '');
    setHighlightsText('');
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
    setFormInitiativeId(a.initiativeId || ledInitiatives[0]?.id || '');
    setHighlightsText(highlightsToText(a.highlights || []));
    setModalOpen(true);
  }

  /* ── Custom form question builder — identical to the curator page's ── */
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
    const options = newType === 'select' && !(current.options || []).length ? [''] : current.options;
    updateQuestion(qId, { type: newType, options });
  }

  async function submitRequest(changeType: 'create' | 'update', activityId: string | null, initiativeId: string, activityTitle: string, payload: Record<string, unknown>) {
    if (!user) return;
    await addDoc(collection(db, 'activity_change_requests'), {
      changeType, activityId, initiativeId, activityTitle, payload,
      proposedBy: user.uid,
      proposedByName: user.displayName || user.email || 'Shaper',
      status: 'pending',
      requestedAt: new Date().toISOString(),
    });
  }

  async function handleSave() {
    if (!form.title.trim() || !formInitiativeId) return;
    setSaving(true);
    try {
      const payload = { ...form, highlights: parseHighlights(highlightsText) };
      await submitRequest(
        editing ? 'update' : 'create',
        editing?.id ?? null,
        formInitiativeId,
        form.title,
        payload,
      );
      setModalOpen(false);
      fetchAll();
    } catch (err) {
      console.error('Failed to submit activity change request:', err);
      alert(t('saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  async function handleRequestToggleActive(a: Activity) {
    try {
      await submitRequest('update', a.id, a.initiativeId!, a.title, { active: !a.active });
      fetchAll();
    } catch (err) {
      console.error('Failed to request activity toggle:', err);
      alert(t('saveFailed'));
    }
  }

  async function handleRequestToggleArchive(a: Activity) {
    try {
      await submitRequest('update', a.id, a.initiativeId!, a.title, { archived: !a.archived });
      fetchAll();
    } catch (err) {
      console.error('Failed to request activity archive toggle:', err);
      alert(t('saveFailed'));
    }
  }

  async function handleCancelRequest(reqId: string) {
    try {
      await deleteDoc(doc(db, 'activity_change_requests', reqId));
      setPendingRequests(prev => prev.filter(r => r.id !== reqId));
    } catch (err) {
      console.error('Failed to cancel change request:', err);
      alert(t('saveFailed'));
    }
  }

  if (loading) {
    return <p className={styles.empty}>{t('loading')}</p>;
  }

  if (ledInitiatives.length === 0) {
    return <p className={styles.empty}>{t('notALeadYet')}</p>;
  }

  const pendingCreateRequests = pendingRequests.filter(r => r.changeType === 'create');

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>{t('myActivitiesTitle')}</h1>
          <p className={styles.subtitle}>{t('myActivitiesSubtitle')}</p>
        </div>
        <button className={styles.newBtn} onClick={openCreate}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          {t('proposeActivityBtn')}
        </button>
      </div>

      {pendingCreateRequests.length > 0 && (
        <div className={styles.proposalsSection}>
          <h3 className={styles.proposalsTitle}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            {t('pendingActivityProposals')}
          </h3>
          <div className={styles.proposalsList}>
            {pendingCreateRequests.map(r => (
              <div key={r.id} className={styles.proposalRow}>
                <div className={styles.proposalInfo}>
                  <span className={styles.proposalName}>{r.activityTitle}</span>
                  <span className={styles.proposalMeta}>{t('pendingChangeBadge')}</span>
                </div>
                <div className={styles.proposalActions}>
                  <button className={styles.declineProposalBtn} onClick={() => handleCancelRequest(r.id)}>{t('cancelChangeRequest')}</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activities.length === 0 ? (
        <div className={styles.emptyState}>
          <p className={styles.emptyTitle}>{t('noActivities')}</p>
          <p className={styles.emptyDesc}>{t('myActivitiesSubtitle')}</p>
        </div>
      ) : (
        <div className={styles.list}>
          {activities.map(a => {
            const pending = pendingForActivity(a.id);
            return (
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
                  {a.archived && <span className={styles.badge + ' ' + styles.badgeArchived}>{t('filterArchived')}</span>}
                </div>
                {a.description && <p className={styles.cardDesc}>{a.description}</p>}
                {pending ? (
                  <p className={styles.proposalMeta}>{t('changeRequestPendingNotice')}</p>
                ) : (
                  <div className={styles.cardActions}>
                    <button className={styles.editBtn} onClick={() => openEdit(a)}>{t('editActivity')}</button>
                    <button
                      className={styles.toggleBtn + ' ' + (a.active ? styles.toggleOff : styles.toggleOn)}
                      onClick={() => handleRequestToggleActive(a)}
                    >
                      {a.active ? t('setHidden') : t('setActive')}
                    </button>
                    <button className={styles.toggleBtn + ' ' + styles.toggleOff} onClick={() => handleRequestToggleArchive(a)}>
                      {a.archived ? t('unarchiveActivity') : t('archiveActivity')}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {modalOpen && (
        <ModalPortal>
        <div className={styles.overlay} onClick={() => { if (confirm(t('confirmDiscardChanges'))) setModalOpen(false); }}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>{editing ? t('editActivity') : t('proposeActivityBtn')}</h2>
              <button className={styles.closeBtn} onClick={() => setModalOpen(false)}>✕</button>
            </div>

            <div className={styles.modalBody}>
              {ledInitiatives.length > 1 && (
                <div className={styles.field}>
                  <label className={styles.label}>{t('selectInitiativeLabel')} *</label>
                  <select className={styles.input} value={formInitiativeId} onChange={e => setFormInitiativeId(e.target.value)}>
                    {ledInitiatives.map(init => (
                      <option key={init.id} value={init.id}>{init.title}</option>
                    ))}
                  </select>
                </div>
              )}

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
                  onChange={e => setForm(f => ({ ...f, kind: e.target.value as ActivityFormData['kind'] }))}
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
                            {(q.options || []).filter(o => o.trim()).length === 0 && (
                              <p className={styles.optionsWarning}>{t('activityQuestionNoOptionsWarning')}</p>
                            )}
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
              <button className={styles.saveBtn} onClick={handleSave} disabled={saving || !form.title.trim() || !formInitiativeId}>
                {saving ? t('savingDots') : t('proposeChangesBtn')}
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}
    </div>
  );
}
