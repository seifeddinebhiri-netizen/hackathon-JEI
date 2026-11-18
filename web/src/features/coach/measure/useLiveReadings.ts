import { useEffect, useRef, useState } from 'react';
import { allOkReadings, CHECKS, type CheckId, type Readings } from '../checks';
import {
  compare,
  INITIAL_SMOOTHED,
  NO_MEASUREMENTS,
  smoothReading,
  type Measurements,
  type Smoothed,
} from './compare';
import { faceMetrics } from './face';
import type { Box, FrameStats } from './imageStats';
import type { OrientationSample } from './useOrientation';
import type { Targets } from './targets';

const TICK_MS = 100;

type Sources = {
  orientation: () => OrientationSample | null;
  frame: () => FrameStats | null;
  face: () => Box | null;
};

export type Live = {
  readings: Readings;
  unmeasured: ReadonlySet<CheckId>;
  notApplicable: ReadonlySet<CheckId>;
  measurements: Measurements;
};

/** État de départ, avant la première mesure : déjà « sans objet » pour ce qu'un plan ne demande pas. */
function startingLive(targets: Targets): Live {
  const { unmeasured, notApplicable } = compare(targets, NO_MEASUREMENTS);
  return { readings: allOkReadings(), unmeasured, notApplicable, measurements: NO_MEASUREMENTS };
}

/** Rassemble les mesures des trois capteurs toutes les 0,1 s et les compare aux cibles du plan. */
/** Les cibles du plan, ou une fonction qui les donne à l'instant présent (plan en mouvement). */
export type TargetsSource = Targets | (() => Targets);
const resolveTargets = (t: TargetsSource): Targets => (typeof t === 'function' ? t() : t);

export function useLiveReadings(
  enabled: boolean,
  targets: TargetsSource,
  sources: Sources,
  /** Appelé quand un voyant repasse au vert (pour oublier une consigne « ignorée »). */
  onGreen: (id: CheckId) => void,
): Live {
  const [live, setLive] = useState<Live>(() => startingLive(resolveTargets(targets)));
  const smoothed = useRef<Record<string, Smoothed>>({});
  const latest = useRef({ targets, sources, onGreen });
  useEffect(() => {
    latest.current = { targets, sources, onGreen };
  });

  useEffect(() => {
    if (!enabled) return;
    const timer = setInterval(() => {
      const { targets: source, sources: s, onGreen: green } = latest.current;
      const t = resolveTargets(source);
      const o = s.orientation();
      const f = s.frame();
      const faceBox = s.face();
      const m: Measurements = {
        roll: o?.rollValid ? o.roll : null,
        pitch: o ? o.pitch : null,
        shake: o?.shake ?? null,
        luma: f?.luma ?? null,
        contrast: f?.contrast ?? null,
        warmth: f?.warmth ?? null,
        clipHigh: f?.clipHigh ?? null,
        clipLow: f?.clipLow ?? null,
        face: faceBox ? faceMetrics(faceBox) : null,
        backlightRatio:
          f?.faceLuma && f.backgroundLuma !== null ? f.backgroundLuma / Math.max(f.faceLuma, 0.02) : null,
      };
      const { readings: raw, unmeasured, notApplicable } = compare(t, m);

      const now = performance.now();
      const shown = {} as Record<CheckId, Readings[CheckId]>;
      for (const c of CHECKS) {
        const before = smoothed.current[c.id] ?? INITIAL_SMOOTHED;
        const next =
          unmeasured.has(c.id) || notApplicable.has(c.id)
            ? INITIAL_SMOOTHED
            : smoothReading(before, raw[c.id], now);
        if (!before.shown.ok && next.shown.ok) green(c.id);
        smoothed.current[c.id] = next;
        shown[c.id] = next.shown;
      }
      setLive({ readings: shown, unmeasured, notApplicable, measurements: m });
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [enabled]);

  return live;
}
