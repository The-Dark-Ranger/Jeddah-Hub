/** Shared between the curators' direct-write Hub Activities page and members'
 *  approval-gated My Hub Activities, plus the code that applies an approved
 *  activity_change_requests payload: one place for the Hub Activity shape, so
 *  a proposal and a curator's own edit always agree on what an activity is. */

export interface Highlight { name: string; tag: string; }

export interface CustomFormQuestion {
  id: string;
  label: string;
  /** 'rating' is a 1 to 5 star score, stored as "1"…"5". */
  type: 'text' | 'textarea' | 'select' | 'checkbox' | 'rating';
  options?: string[];
  required: boolean;
}

/** Whether the registration form asks for the registrant's name/email. */
export type ContactFieldMode = 'off' | 'optional' | 'required';

export interface CustomForm {
  enabled: boolean;
  questions: CustomFormQuestion[];
  /* Optional wording around the questions, the form's title and button
     always use the site's defaults, so nothing here repeats the activity. */
  intro?: string;
  successMessage?: string;
  collectName?: ContactFieldMode;
  collectEmail?: ContactFieldMode;
  /** Keeps the form visible but stops new registrations. */
  closed?: boolean;
}

/** Hard caps for the frame's free text, mirrored in the builder inputs. */
export const FORM_TEXT_MAX = { intro: 600, successMessage: 400 } as const;

export type ActivityKind = 'activity' | 'workshop';

/** Which of an activity's two forms a response answers: the registration
 *  form before the event, or the feedback form after it. */
export type FormType = 'registration' | 'feedback';

export interface ActivityFormData {
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
  kind: ActivityKind;
  customForm: CustomForm;
  /** The after-event form (feedback from attendees). Same shape as the
   *  registration form; hidden from the page until it is opened. */
  feedbackForm: CustomForm;
  /** Cover photo, a remote URL or a compressed data URI (ImageUploader). */
  imageUrl: string;
  /** Extra gallery photos shown on the activity's own page. */
  images: string[];
  /** Accent colour (#rrggbb) used for the activity's badge, button and hero. */
  color: string;
}

/** A Hub Activity as stored: an initiatives doc tagged type 'hub_activity'.
 *  Older documents can lack any of the form's fields. */
export interface HubActivity extends Partial<Omit<ActivityFormData, 'title'>> {
  id: string;
  title: string;
  slug?: string;
  archived?: boolean;
  /** The initiative it belongs to, when it isn't for the whole hub. */
  initiativeId?: string;
  /** The member whose approved proposal created it. */
  proposedBy?: string;
  createdAt?: { toMillis?: () => number };
}

/** activity_change_requests: a member's request to create or change an
 *  activity, waiting for a reviewer (see firestore.rules). */
export interface ActivityChangeRequest {
  id: string;
  changeType: 'create' | 'update';
  activityId: string | null;
  /** Empty when the activity is for the whole hub. */
  initiativeId: string;
  activityTitle: string;
  payload: Record<string, unknown>;
  proposedBy: string;
  proposedByName?: string;
  status: 'pending' | 'approved' | 'declined';
  requestedAt?: string;
  reviewedAt?: string;
  /** The reviewer's note to the sender. */
  reviewNote?: string;
}

/** The only fields a change request's `payload` may carry through to a
 *  live `initiatives` (hub_activity) doc, applied explicitly at approval
 *  time rather than spreading `payload` wholesale, so a malicious payload
 *  can't smuggle an unexpected field (e.g. `type`, `initiativeId`, or
 *  `slug`) past a curator who just clicks Approve. */
const ACTIVITY_PAYLOAD_KEYS = [
  'title', 'eyebrow', 'subtitle', 'description', 'date', 'location',
  'ctaText', 'ctaUrl', 'highlights', 'active', 'archived', 'kind', 'customForm', 'feedbackForm',
  'imageUrl', 'images', 'color',
] as const;

/** Picks only the known activity fields present in a change request's
 *  payload, dropping anything else. Used at approval time. */
export function pickActivityFields(payload: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of ACTIVITY_PAYLOAD_KEYS) {
    if (key in payload) out[key] = payload[key];
  }
  return out;
}

/** Same value whatever order Firestore returned a map's keys in. */
function stableJson(value: unknown): string {
  return JSON.stringify(value ?? '', (_key, v: unknown) => (
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)))
      : v
  ));
}

/** The fields of a request's payload that differ from the live activity, so a
 *  reviewer sees what would change rather than the whole form. */
export function changedActivityFields(payload: Record<string, unknown>, live: HubActivity): Record<string, unknown> {
  const current = live as unknown as Record<string, unknown>;
  return Object.fromEntries(Object.entries(pickActivityFields(payload))
    .filter(([key, value]) => stableJson(value) !== stableJson(current[key])));
}

export const emptyCustomForm = (): CustomForm => ({ enabled: false, questions: [] });

/** A new after-event form: off, closed until the event is over, asks for a
 *  name (optional) but not an email. */
const emptyFeedbackForm = (): CustomForm => ({
  enabled: false, questions: [], closed: true, collectName: 'optional', collectEmail: 'off',
});

export const emptyActivityForm = (): ActivityFormData => ({
  title: '', eyebrow: '', subtitle: '', description: '',
  date: '', location: '', ctaText: '', ctaUrl: '',
  highlights: [], active: true, kind: 'activity', customForm: emptyCustomForm(),
  feedbackForm: emptyFeedbackForm(),
  imageUrl: '', images: [], color: '',
});

/** Builds an edit form from a stored activity, filling any field an older
 *  doc predates so the form never sends undefined to Firestore. */
export function activityToForm(a: Partial<ActivityFormData>): ActivityFormData {
  const base = emptyActivityForm();
  return {
    title: a.title ?? base.title,
    eyebrow: a.eyebrow ?? base.eyebrow,
    subtitle: a.subtitle ?? base.subtitle,
    description: a.description ?? base.description,
    date: a.date ?? base.date,
    location: a.location ?? base.location,
    ctaText: a.ctaText ?? base.ctaText,
    ctaUrl: a.ctaUrl ?? base.ctaUrl,
    highlights: a.highlights ?? base.highlights,
    active: a.active ?? base.active,
    kind: a.kind || base.kind,
    customForm: a.customForm || base.customForm,
    feedbackForm: a.feedbackForm || base.feedbackForm,
    imageUrl: a.imageUrl ?? base.imageUrl,
    images: Array.isArray(a.images) ? a.images : base.images,
    color: safeColor(a.color) ?? '',
  };
}

/** Curated accent palette offered as one-tap swatches in the colour picker. */
export const ACCENT_SWATCHES = [
  '#0F5A9F', '#1D4ED8', '#0891B2', '#0D9488', '#16A34A', '#65A30D',
  '#CA8A04', '#EA580C', '#DC2626', '#DB2777', '#9333EA', '#475569',
] as const;

/** Returns the colour only if it is a plain #rgb/#rrggbb hex, anything
 *  else (stored by an old client or a hand-edited doc) is dropped rather
 *  than written into an inline style. */
export function safeColor(value: unknown): string | undefined {
  return typeof value === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value) ? value : undefined;
}

export function newQuestionId(): string {
  return `q_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function parseHighlights(raw: string): Highlight[] {
  return raw
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
    .map(l => {
      // Accept the Arabic comma (،) too, Arabic keyboards type it by default.
      const [name, ...rest] = l.split(/[,،]/);
      return { name: name.trim(), tag: rest.join(', ').trim() };
    });
}

export function highlightsToText(hs: Highlight[]): string {
  return hs.map(h => `${h.name},${h.tag}`).join('\n');
}
