import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Le décompte d'un plan en mouvement : les secondes se comptent depuis le début de la prise.
 *  - il démarre à l'enregistrement (`recordingStartedAt`, instant donné par l'enregistreur) ;
 *  - ou en « répétition » : on lance le décompte sans enregistrer, pour s'entraîner ;
 *  - il s'arrête à la durée du plan (phase « finished »).
 * `getElapsed()` se lit sans re-rendre (pour les mesures, 10 fois par seconde) ; `elapsed` sert à l'affichage.
 */
export type ClockPhase = 'idle' | 'running' | 'finished';

export function useShotClock(durationS: number | null, recordingStartedAt: number | null) {
  const [rehearsalStart, setRehearsalStart] = useState<number | null>(null);
  const [now, setNow] = useState(() => performance.now());
  const startedAt = durationS === null ? null : (recordingStartedAt ?? rehearsalStart);

  const startRef = useRef<number | null>(null);
  useEffect(() => {
    startRef.current = startedAt;
  });

  // Rafraîchit l'affichage 5 fois par seconde tant que le décompte tourne.
  useEffect(() => {
    if (startedAt === null) return;
    const timer = setInterval(() => setNow(performance.now()), 200);
    return () => clearInterval(timer);
  }, [startedAt]);

  const getElapsed = useCallback(
    (): number | null => (startRef.current === null ? null : (performance.now() - startRef.current) / 1000),
    [],
  );
  const startRehearsal = useCallback(() => setRehearsalStart(performance.now()), []);
  const stopRehearsal = useCallback(() => setRehearsalStart(null), []);

  const elapsed = startedAt === null ? null : Math.max(0, (now - startedAt) / 1000);
  const phase: ClockPhase =
    elapsed === null || durationS === null ? 'idle' : elapsed >= durationS ? 'finished' : 'running';
  return {
    phase,
    elapsed,
    getElapsed,
    startRehearsal,
    stopRehearsal,
    rehearsing: recordingStartedAt === null && rehearsalStart !== null,
  };
}
