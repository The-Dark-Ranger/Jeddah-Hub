'use client';

/* Stops a button from running its action twice: a double click, or a second
 * click while the first save is still on its way, would otherwise send the
 * same approval or request twice. Each action has a key (usually its row's
 * id), so other rows stay usable meanwhile. */
import { useCallback, useRef, useState } from 'react';

export function useBusy() {
  // The ref answers at once, before React redraws (that is what catches a
  // double click); the state redraws the buttons as disabled.
  const running = useRef(new Set<string>());
  const [busy, setBusy] = useState<ReadonlySet<string>>(() => new Set());

  /** Runs `action` unless the same key is already running. */
  const run = useCallback(async (key: string, action: () => Promise<unknown>): Promise<void> => {
    if (running.current.has(key)) return;
    running.current.add(key);
    setBusy(new Set(running.current));
    try {
      await action();
    } finally {
      running.current.delete(key);
      setBusy(new Set(running.current));
    }
  }, []);

  const isBusy = useCallback((key: string) => busy.has(key), [busy]);
  return { run, isBusy };
}
