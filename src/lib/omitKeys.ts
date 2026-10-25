/** A shallow copy of `obj` without the listed keys, e.g. to strip a
 *  request's bookkeeping fields before turning it into a real document. */
export function omitKeys<T extends Record<string, unknown>>(obj: T, keys: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) if (!keys.includes(k)) out[k] = v;
  return out;
}
