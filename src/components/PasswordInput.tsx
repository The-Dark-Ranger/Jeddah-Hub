'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import styles from './PasswordInput.module.css';

const EYE = 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z';
const EYE_OFF = 'M17.94 17.94A10.1 10.1 0 0 1 12 19c-6.4 0-10-7-10-7a18.4 18.4 0 0 1 4.06-4.94M9.9 5.24A9.1 9.1 0 0 1 12 5c6.4 0 10 7 10 7a18.5 18.5 0 0 1-2.16 3.19M14.12 14.12a3 3 0 1 1-4.24-4.24M2 2l20 20';

/** A password field with an eye button to show what was typed, so a
 *  mistyped password can be spotted before submitting. Always starts hidden. */
export default function PasswordInput(props: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const t = useTranslations('PasswordInput');
  const [visible, setVisible] = useState(false);
  return (
    <div className={styles.wrap}>
      <input {...props} type={visible ? 'text' : 'password'} className={(props.className ?? '') + ' ' + styles.input}
        autoCapitalize="none" autoCorrect="off" spellCheck={false} />
      <button
        type="button"
        className={styles.toggle}
        onClick={() => setVisible(v => !v)}
        aria-label={visible ? t('hide') : t('show')}
        aria-pressed={visible}
        title={visible ? t('hide') : t('show')}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d={visible ? EYE_OFF : EYE} />
        </svg>
      </button>
    </div>
  );
}
