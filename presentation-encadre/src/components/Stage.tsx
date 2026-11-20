import { useEffect, useState, type ReactNode } from 'react';
import { STAGE_H, STAGE_W } from '@/hooks/deckEnv';

/**
 * Scène logique 1920 × 1080 mise à l'échelle de la fenêtre (bandes noires si le ratio diffère).
 * Toutes les compositions sont donc identiques en 1920 × 1080, 1366 × 768 ou sur un projecteur.
 */
export function useStageScale() {
  const compute = () => Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H);
  const [scale, setScale] = useState(compute);
  useEffect(() => {
    const on = () => setScale(compute());
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return scale;
}

export function Stage({ scale, children }: { scale: number; children: ReactNode }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center overflow-hidden bg-black">
      <div
        id="stage"
        className="relative shrink-0 overflow-hidden bg-ink"
        style={{
          width: STAGE_W,
          height: STAGE_H,
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
        }}
      >
        {children}
      </div>
    </div>
  );
}
