/* Unsaved writing kept on this device, so a reload, a closed tab or a weak
 * connection doesn't lose a long text. Keys are per member, and every draft
 * is wiped on sign-out so the next person on a shared device can't see it. */
import { useEffect } from 'react';

const PREFIX = 'jh-draft:';

export function readDraft<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch { return null; }
}

export function clearDraft(key: string) {
  try { localStorage.removeItem(PREFIX + key); } catch { /* storage blocked */ }
}

/** Removes every saved draft (called on sign-out). */
export function clearAllDrafts() {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k?.startsWith(PREFIX)) localStorage.removeItem(k);
    }
  } catch { /* storage blocked */ }
}

/** Saves `value` under `key` shortly after it stops changing. Pass a null
 *  key to pause saving (e.g. while editing an already-published post). */
export function useDraftAutosave(key: string | null, value: unknown, isEmpty: boolean) {
  const json = JSON.stringify(value);
  useEffect(() => {
    if (!key) return;
    const id = setTimeout(() => {
      try {
        if (isEmpty) localStorage.removeItem(PREFIX + key);
        else localStorage.setItem(PREFIX + key, json);
      } catch { /* storage full or blocked: nothing to keep */ }
    }, 500);
    return () => clearTimeout(id);
  }, [key, json, isEmpty]);
}
