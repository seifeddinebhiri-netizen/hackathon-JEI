import { useCallback, useEffect, useRef } from 'react';
import { rollPitch, ShakeMeter, smoothVec, upFromEuler, type RollPitch, type Vec3 } from './orientation';

type MotionPermissionApi = { requestPermission?: () => Promise<'granted' | 'denied'> };

/**
 * iPhone (iOS 13+) : les capteurs de mouvement exigent une autorisation, à demander DANS le geste
 * de l'utilisateur (le toucher sur « Ouvrir la caméra »). Android : aucune autorisation.
 */
export async function requestMotionPermission(): Promise<'granted' | 'denied' | 'unsupported'> {
  const api = (globalThis as { DeviceOrientationEvent?: MotionPermissionApi }).DeviceOrientationEvent;
  if (!api) return 'unsupported';
  if (typeof api.requestPermission !== 'function') return 'granted';
  try {
    return await api.requestPermission();
  } catch {
    return 'denied';
  }
}

export type OrientationSample = RollPitch & {
  /** Rotation efficace sur la dernière seconde, en rad/s (null tant qu'il manque des mesures). */
  shake: number | null;
};

function screenAngle(): number {
  return screen.orientation?.angle ?? (window as { orientation?: number }).orientation ?? 0;
}

/**
 * Écoute les capteurs de mouvement tant que `active`. Les valeurs vivent dans des références
 * (jusqu'à 60 mises à jour par seconde) : `read()` donne la dernière, sans re-rendre l'écran.
 * `read()` renvoie null si aucun signal n'est arrivé récemment (capteurs absents ou refusés).
 */
export function useOrientation(active: boolean) {
  const up = useRef<Vec3 | null>(null);
  const lastAt = useRef(0);
  const shake = useRef(new ShakeMeter());

  useEffect(() => {
    if (!active) return;
    const onOrientation = (e: DeviceOrientationEvent) => {
      if (e.beta === null || e.gamma === null) return;
      up.current = smoothVec(up.current, upFromEuler(e.beta, e.gamma), 0.25);
      lastAt.current = performance.now();
    };
    const onMotion = (e: DeviceMotionEvent) => {
      const r = e.rotationRate;
      if (r && r.alpha !== null && r.beta !== null && r.gamma !== null) {
        shake.current.push(performance.now(), Math.hypot(r.alpha, r.beta, r.gamma));
      }
    };
    window.addEventListener('deviceorientation', onOrientation);
    window.addEventListener('devicemotion', onMotion);
    return () => {
      window.removeEventListener('deviceorientation', onOrientation);
      window.removeEventListener('devicemotion', onMotion);
    };
  }, [active]);

  const read = useCallback((): OrientationSample | null => {
    if (!up.current || performance.now() - lastAt.current > 1500) return null;
    return { ...rollPitch(up.current, screenAngle()), shake: shake.current.rms() };
  }, []);

  return { read };
}
