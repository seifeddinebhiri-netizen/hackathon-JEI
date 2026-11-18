import { useCallback, useEffect, useRef, type RefObject } from 'react';
import { applyAdjustRgba, isNeutral, type Adjust } from '../imageFilter';
import { analyzeRgba, type Box, type FrameStats } from './imageStats';

const NO_ADJUST = (): Adjust | null => null;
const SAMPLE_WIDTH = 64; // l'image est réduite à 64 px de large : rapide, et rien n'est conservé
const INTERVAL_MS = 150;

/**
 * Mesure l'image de la caméra (luminosité, contraste, chaleur, contre-jour) environ 7 fois par
 * seconde, sur un échantillon réduit. `getFace` donne la zone du visage pour le contre-jour.
 * Si une retouche est active, elle est appliquée à l'échantillon avant la mesure (même formule que l'affichage).
 */
export function useFrameStats(
  videoRef: RefObject<HTMLVideoElement | null>,
  active: boolean,
  getFace: () => Box | null,
  /** Réglages de retouche en cours (null : aucune) : la mesure porte alors sur l'image retouchée. */
  getAdjust: () => Adjust | null = NO_ADJUST,
) {
  const stats = useRef<FrameStats | null>(null);

  useEffect(() => {
    if (!active) return;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    const timer = setInterval(() => {
      const video = videoRef.current;
      if (!video || video.readyState < 2 || video.videoWidth === 0) return;
      canvas.width = SAMPLE_WIDTH;
      canvas.height = Math.max(1, Math.round((SAMPLE_WIDTH * video.videoHeight) / video.videoWidth));
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const adjust = getAdjust();
      if (adjust && !isNeutral(adjust)) applyAdjustRgba(data, adjust);
      stats.current = analyzeRgba(data, canvas.width, canvas.height, getFace());
    }, INTERVAL_MS);
    return () => {
      clearInterval(timer);
      stats.current = null;
    };
  }, [videoRef, active, getFace, getAdjust]);

  return { read: useCallback(() => stats.current, []) };
}
