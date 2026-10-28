'use client';

/* The team-role picker in the initiative team panels: Member, Lead or
 * Co-Lead (the same rights as a Lead). Stores the English role name. */
import { useTranslations } from 'next-intl';
import { TEAM_ROLES, type TeamRole } from '@/lib/types';

export default function TeamRoleSelect({ value, onChange, className }: {
  value: TeamRole;
  onChange: (role: TeamRole) => void;
  className?: string;
}) {
  const t = useTranslations('Dashboard');
  return (
    <select className={className} value={value} onChange={e => onChange(e.target.value as TeamRole)} aria-label={t('teamRoleLabel')}>
      {TEAM_ROLES.map(r => <option key={r} value={r}>{teamRoleLabel(t, r)}</option>)}
    </select>
  );
}

/** A team role in the reader's language (custom older roles show as typed). */
export function teamRoleLabel(t: (key: 'teamRoleMember' | 'teamRoleLead' | 'teamRoleCoLead') => string, role?: string | null): string {
  if (!role || /^member$/i.test(role)) return t('teamRoleMember');
  if (/^co-?lead$/i.test(role)) return t('teamRoleCoLead');
  if (/^lead$/i.test(role)) return t('teamRoleLead');
  return role;
}
