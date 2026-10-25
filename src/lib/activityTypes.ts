/** Shared between the curator's direct-write Activities dashboard and the
 *  lead's approval-gated one (dashboard/shaper/activities), plus the
 *  curator-side code that applies an approved activity_change_requests
 *  payload, one place for the Hub Activity shape so a lead's proposal and
 *  a curator's own edit form always agree on what an activity is. */

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

export const emptyCustomForm = (): CustomForm => ({ enabled: false, questions: [] });

/** A new after-event form: off, closed until the event is over, asks for a
 *  name (optional) but not an email. */
export const emptyFeedbackForm = (): CustomForm => ({
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
