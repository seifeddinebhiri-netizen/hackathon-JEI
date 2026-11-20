import { useLayoutEffect, useRef, type RefObject } from 'react';
import gsap from 'gsap';
import { useDeckEnv } from './deckEnv';

/**
 * Une scène = UNE timeline GSAP en pause, découpée par des labels « b0 », « b1 »…
 * L'état de l'étape k est la position du label « bk ».
 *  - étape suivante : la timeline joue jusqu'au label (le présentateur garde la main) ;
 *  - retour arrière, saut ou export : la timeline se place directement sur le label ;
 *  - animations réduites : placement direct, sans mouvement.
 *
 * `build(tl)` ajoute les tweens et les labels, dans un gsap.context limité à `scope`
 * (les sélecteurs « .x » ne visent que la scène, et tout est nettoyé au démontage).
 */
export function useBeatTimeline(
  scope: RefObject<HTMLElement | null>,
  beat: number,
  build: (tl: gsap.core.Timeline) => void,
) {
  const { reduced, print } = useDeckEnv();
  const tlRef = useRef<gsap.core.Timeline | null>(null);
  const playRef = useRef<gsap.core.Tween | null>(null);
  const prevBeat = useRef(-1);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ paused: true, defaults: { ease: 'power3.out', duration: 0.7 } });
      build(tl);
      tlRef.current = tl;
    }, scope);
    return () => {
      playRef.current?.kill();
      ctx.revert();
      tlRef.current = null;
      prevBeat.current = -1;
    };
    // La timeline est construite une seule fois par montage de la scène.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useLayoutEffect(() => {
    const tl = tlRef.current;
    if (!tl) return;
    const label = `b${beat}`;
    const target = tl.labels[label] ?? tl.duration();
    playRef.current?.kill();
    const stepForward = beat === prevBeat.current + 1;
    if (print || reduced || !stepForward) {
      tl.seek(target, false);
      // Animations réduites : l'étape suivante apparaît par un simple fondu, sans mouvement
      if (reduced && !print && stepForward && scope.current) {
        gsap.fromTo(scope.current, { opacity: 0.25 }, { opacity: 1, duration: 0.3, ease: 'none', overwrite: true });
      }
    } else {
      // On repart de l'état propre de l'étape précédente, puis on joue jusqu'à la suivante
      const from = tl.labels[`b${beat - 1}`] ?? 0;
      if (Math.abs(tl.time() - from) > 0.001 && beat > 0) tl.seek(from, false);
      playRef.current = tl.tweenTo(target, { ease: 'none' });
    }
    prevBeat.current = beat;
  }, [beat, print, reduced, scope]);

  return tlRef;
}
