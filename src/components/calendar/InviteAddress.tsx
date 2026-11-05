'use client';

/* Calendar: the reminder that events made in someone's own calendar app show
 * up here when they invite the hub's calendar address. The address isn't
 * decided yet (it will be a Resend address on jeddahhub.org), so it is one
 * constant to change. */
import { useTranslations } from 'next-intl';
import { Icon } from './Icon';
import styles from './Calendar.module.css';

export const HUB_CALENDAR_ADDRESS = 'calendar@jeddahhub.org';

export default function InviteAddress() {
  const t = useTranslations('Calendar');
  return (
    <p className={styles.tip}>
      <Icon name="info" />
      <span><strong>{t('inviteTipTitle')}</strong> {t('inviteTipBody')} <code>{HUB_CALENDAR_ADDRESS}</code></span>
    </p>
  );
}
