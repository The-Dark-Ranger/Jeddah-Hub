import { useTranslations } from 'next-intl';
import { normalizeRole } from '@/lib/role';

/** A member role ("vice_curator", "Vice Curator", …) in the current
 *  language, for use directly in JSX. Unknown roles show as stored. */
export function RoleLabel({ role }: { role: string | null | undefined }) {
  const tr = useTranslations('Role');
  const key = normalizeRole(role);
  if (!key) return null;
  return tr.has(key as 'shaper') ? tr(key as 'shaper') : (role ?? '');
}
