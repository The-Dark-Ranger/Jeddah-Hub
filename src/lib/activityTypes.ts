/** Shared between the curator's direct-write Activities dashboard and the
 *  lead's approval-gated one (dashboard/shaper/activities), plus the
 *  curator-side code that applies an approved activity_change_requests
 *  payload — one place for the Hub Activity shape so a lead's proposal and
 *  a curator's own edit form always agree on what an activity is. */

export interface Highlight { name: string; tag: string; }

export interface CustomFormQuestion {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'checkbox';
  options?: string[];
  required: boolean;
}

export interface CustomForm {
  enabled: boolean;
  questions: CustomFormQuestion[];
}

export type ActivityKind = 'activity' | 'workshop';

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
}

/** The only fields a change request's `payload` may carry through to a
 *  live `initiatives` (hub_activity) doc — applied explicitly at approval
 *  time rather than spreading `payload` wholesale, so a malicious payload
 *  can't smuggle an unexpected field (e.g. `type`, `initiativeId`, or
 *  `slug`) past a curator who just clicks Approve. */
export const ACTIVITY_PAYLOAD_KEYS = [
  'title', 'eyebrow', 'subtitle', 'description', 'date', 'location',
  'ctaText', 'ctaUrl', 'highlights', 'active', 'archived', 'kind', 'customForm',
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

export const emptyActivityForm = (): ActivityFormData => ({
  title: '', eyebrow: '', subtitle: '', description: '',
  date: '', location: '', ctaText: '', ctaUrl: '',
  highlights: [], active: true, kind: 'activity', customForm: emptyCustomForm(),
});

export function newQuestionId(): string {
  return `q_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function parseHighlights(raw: string): Highlight[] {
  return raw
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
    .map(l => {
      const [name, ...rest] = l.split(',');
      return { name: name.trim(), tag: rest.join(',').trim() };
    });
}

export function highlightsToText(hs: Highlight[]): string {
  return hs.map(h => `${h.name},${h.tag}`).join('\n');
}
