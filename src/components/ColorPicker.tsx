'use client';

import { useId, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ACCENT_SWATCHES, safeColor } from '@/lib/activityTypes';
import styles from './ColorPicker.module.css';

interface Props {
  label: string;
  /** '' means "no colour" — the page falls back to the site's default. */
  value: string;
  onChange: (value: string) => void;
}

/** Swatches for one-tap picks, a native picker for anything else, and a
 *  hex field for pasting a brand colour exactly. */
export default function ColorPicker({ label, value, onChange }: Props) {
  const t = useTranslations('Dashboard');
  const id = useId();
  const [hex, setHex] = useState(value);
  const [synced, setSynced] = useState(value);

  // Keep the text field in sync when a swatch or the native picker changes it
  // (adjusting state during render, so there's no extra effect pass).
  if (value !== synced) {
    setSynced(value);
    setHex(value);
  }

  const commitHex = (raw: string) => {
    const v = raw.trim();
    const withHash = v && !v.startsWith('#') ? '#' + v : v;
    setHex(withHash);
    if (!withHash) onChange('');
    else if (safeColor(withHash)) onChange(withHash.toUpperCase());
  };

  const current = value.toUpperCase();
  const isCustom = !!value && !ACCENT_SWATCHES.includes(current as (typeof ACCENT_SWATCHES)[number]);

  return (
    <div className={styles.wrap}>
      <span className={styles.label} id={id + '-label'}>{label}</span>

      <div className={styles.swatches} role="radiogroup" aria-labelledby={id + '-label'}>
        <button
          type="button"
          role="radio"
          aria-checked={!value}
          className={styles.swatch + ' ' + styles.swatchNone + (!value ? ' ' + styles.swatchActive : '')}
          onClick={() => onChange('')}
          title={t('fieldThemeColorNone')}
          aria-label={t('fieldThemeColorNone')}
        />
        {ACCENT_SWATCHES.map(c => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={current === c}
            className={styles.swatch + (current === c ? ' ' + styles.swatchActive : '')}
            style={{ background: c }}
            onClick={() => onChange(c)}
            title={c}
            aria-label={c}
          />
        ))}
        <label
          className={styles.swatch + ' ' + styles.swatchCustom + (isCustom ? ' ' + styles.swatchActive : '')}
          style={isCustom ? { background: value } : undefined}
          title={t('customColor')}
        >
          <input
            type="color"
            className={styles.native}
            value={safeColor(value) && value.length === 7 ? value : '#0F5A9F'}
            onChange={e => onChange(e.target.value.toUpperCase())}
            aria-label={t('customColor')}
          />
        </label>
      </div>

      <div className={styles.hexRow}>
        <span
          className={styles.preview + (safeColor(value) ? '' : ' ' + styles.swatchNone)}
          style={safeColor(value) ? { background: safeColor(value)! } : undefined}
          aria-hidden="true"
        />
        <input
          className={styles.hexInput + (hex && !safeColor(hex) ? ' ' + styles.hexInvalid : '')}
          value={hex}
          onChange={e => commitHex(e.target.value)}
          placeholder="#0F5A9F"
          maxLength={7}
          spellCheck={false}
          autoComplete="off"
          dir="ltr"
          aria-label={t('hexColor')}
        />
        {value && (
          <button type="button" className={styles.clear} onClick={() => onChange('')}>
            {t('clearColor')}
          </button>
        )}
      </div>
    </div>
  );
}
