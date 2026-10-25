import { useTranslations } from 'next-intl';
import { normalizeRole } from '@/lib/role';

/** Returns a function giving a member role ("vice_curator", "Vice Curator",
 *  …) in the current language, for search text and attributes. Unknown
 *  roles come back as stored. */
export function useRoleLabel() {
  const tr = useTranslations('Role');
  return (role: string | null | undefined): string => {
    const key = normalizeRole(role);
    if (!key) return '';
    return tr.has(key as 'shaper') ? tr(key as 'shaper') : (role ?? '');
  };
}

/** The same label, for use directly in JSX. */
export function RoleLabel({ role }: { role: string | null | undefined }) {
  return useRoleLabel()(role) || null;
}
