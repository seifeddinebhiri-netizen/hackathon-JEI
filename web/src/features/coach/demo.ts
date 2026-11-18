import { useEffect, useRef } from 'react';
import { allOkReadings, CHECKS, flipReading, type Readings } from './checks';

/** Rythme de la démonstration automatique (en millisecondes). */
export const DEMO_START_MS = 800;
export const DEMO_SHOW_MS = 2800;
export const DEMO_FADE_MS = 300;
export const DEMO_GAP_MS = 1000;

/** Étape n de la démo : un seul voyant rouge (chacun à son tour), variante et valeur au hasard. */
export function demoStep(index: number, random: () => number = Math.random): Readings {
  const check = CHECKS[index % CHECKS.length];
  return { ...allOkReadings(), [check.id]: flipReading(check.id, { ok: true }, random) };
}

/**
 * Démonstration automatique : une consigne apparaît, reste affichée, s'efface en fondu, puis la
 * suivante arrive avec d'autres valeurs. Remplace les vraies mesures tant qu'elles n'existent pas.
 * `apply` reçoit l'état des voyants ; `setLeaving(true)` demande le fondu de sortie.
 */
export function useAutoDemo(
  enabled: boolean,
  apply: (readings: Readings) => void,
  setLeaving: (leaving: boolean) => void,
): void {
  const index = useRef(0);
  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout>;
    const show = () => {
      setLeaving(false);
      apply(demoStep(index.current++));
      timer = setTimeout(fade, DEMO_SHOW_MS);
    };
    const fade = () => {
      setLeaving(true);
      timer = setTimeout(hide, DEMO_FADE_MS);
    };
    const hide = () => {
      apply(allOkReadings());
      setLeaving(false);
      timer = setTimeout(show, DEMO_GAP_MS);
    };
    timer = setTimeout(show, DEMO_START_MS);
    return () => clearTimeout(timer);
  }, [enabled, apply, setLeaving]);
}
