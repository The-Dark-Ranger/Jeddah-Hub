/* Each member role's colour, used wherever a role is shown: the Who We Are
 * cards, the dashboard banner and the sidebar profile card. */
import { normalizeRole } from '@/lib/role';

export const ROLE_ACCENT: Record<string, string> = {
  curator: '#0f5a9f',        // hub blue
  vice_curator: '#7c3aed',   // purple
  impact_officer: '#059669', // green
  shaper: '#d97706',         // amber
  alumni: '#64748b',         // slate
};

/** Inline style that sets `--role` to the role's colour for CSS to use. */
export function roleStyle(role: string | null | undefined): React.CSSProperties {
  return { '--role': ROLE_ACCENT[normalizeRole(role) ?? ''] ?? ROLE_ACCENT.curator } as React.CSSProperties;
}
