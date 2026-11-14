import { useCallback, useEffect, useRef, useState } from 'react';

export type AutosaveState = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

/**
 * Enregistre automatiquement `value` après `delay` ms sans modification.
 * `flush()` force l'enregistrement immédiat (ex. avant de changer d'étape).
 * L'état « modifié » est dérivé de l'identité de l'objet : à utiliser avec des mises à jour immuables.
 */
export function useAutosave<T>(value: T, save: (v: T) => Promise<unknown>, { delay = 800 } = {}) {
  const [lastSaved, setLastSaved] = useState(value);
  const [phase, setPhase] = useState<'idle' | 'saving' | 'error'>('idle');
  const [everSaved, setEverSaved] = useState(false);
  const latest = useRef(value);
  const saveRef = useRef(save);
  useEffect(() => {
    latest.current = value;
    saveRef.current = save;
  });

  const run = useCallback(async () => {
    const v = latest.current;
    setPhase('saving');
    try {
      await saveRef.current(v);
      setLastSaved(v);
      setEverSaved(true);
      setPhase('idle');
    } catch {
      setPhase('error');
    }
  }, []);

  useEffect(() => {
    if (value === lastSaved || phase !== 'idle') return;
    const t = setTimeout(() => void run(), delay);
    return () => clearTimeout(t);
  }, [value, lastSaved, phase, delay, run]);

  const flush = useCallback(async () => {
    if (latest.current !== lastSaved) await run();
  }, [lastSaved, run]);

  const state: AutosaveState =
    phase === 'saving'
      ? 'saving'
      : phase === 'error'
        ? 'error'
        : value !== lastSaved
          ? 'pending'
          : everSaved
            ? 'saved'
            : 'idle';

  return { state, flush, retry: run };
}
