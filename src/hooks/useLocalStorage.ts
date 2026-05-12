import { useCallback, useEffect, useState } from 'react';

/**
 * Persist a piece of state across reloads via localStorage.
 * JSON-serialized; returns [value, setValue] like useState.
 * Safe with SSR (returns initial during initial server render) and
 * gracefully degrades if localStorage is unavailable.
 */
export function useLocalStorage<T>(
  key: string,
  initial: T,
): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === 'undefined') return initial;
    try {
      const raw = window.localStorage.getItem(key);
      if (raw == null) return initial;
      return JSON.parse(raw) as T;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // quota exceeded or denied — ignore
    }
  }, [key, value]);

  const set = useCallback((v: T) => setValue(v), []);
  return [value, set];
}
