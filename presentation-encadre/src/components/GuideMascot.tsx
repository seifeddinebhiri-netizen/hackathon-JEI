import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { Clapperboard } from './Clapperboard';
import { asset, cx } from './ui';

/**
 * Baba Jamil, guide de tournage. Les poses sont les SVG ORIGINAUX de l'application
 * (web/public/mascotte), avec leurs animations internes. Aucune nouvelle illustration :
 * on anime seulement la position, l'échelle, l'orientation et les accessoires.
 *
 * La mascotte vit dans une couche au-dessus des scènes : d'une scène à l'autre elle marche
 * jusqu'à sa nouvelle marque au lieu de disparaître.
 */
export type Pose = 'salut' | 'parle' | 'montre' | 'planifier' | 'tourner' | 'declarer' | 'diffuser';
export const POSES: Pose[] = ['salut', 'parle', 'montre', 'planifier', 'tourner', 'declarer', 'diffuser'];

export interface MascotSpec {
  /** Centre des pieds, en px de la scène 1920 × 1080 */
  x: number;
  y: number;
  /** Hauteur affichée en px */
  size: number;
  pose: Pose;
  flip?: boolean;
  hidden?: boolean;
  bubble?: string;
  bubbleSide?: 'left' | 'right';
  prop?: 'clap' | 'script' | null;
  /** Ombre au sol (projecteur) */
  shadow?: boolean;
}

const RATIO = 340 / 290;

export function GuideMascot({ spec, reduced, print }: { spec: MascotSpec | null; reduced: boolean; print: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const flipRef = useRef<HTMLDivElement>(null);
  const bubble = useRef<HTMLDivElement>(null);
  const prev = useRef<MascotSpec | null>(null);
  const tl = useRef<gsap.core.Timeline | null>(null);

  useLayoutEffect(() => {
    const el = root.current;
    if (!el || !spec) return;
    const p = prev.current;
    const instant = reduced || print || !p;
    tl.current?.kill();
    const t = gsap.timeline();
    tl.current = t;

    const w = spec.size * RATIO;
    const target = { x: spec.x - w / 2, y: spec.y - spec.size, width: w, height: spec.size };
    const hidden = !!spec.hidden;

    // Pose : fondu enchaîné entre les SVG originaux
    const poses = el.querySelectorAll<HTMLImageElement>('[data-pose]');
    poses.forEach((img) => {
      const on = img.dataset.pose === spec.pose;
      if (instant) gsap.set(img, { opacity: on ? 1 : 0 });
      else t.to(img, { opacity: on ? 1 : 0, duration: 0.25 }, 0);
    });

    // Bulle : cachée pendant le déplacement, puis affichée
    if (bubble.current) {
      gsap.set(bubble.current, { opacity: 0, y: 10 });
    }

    if (instant) {
      gsap.set(el, { ...target, opacity: hidden ? 0 : 1, scale: 1 });
      gsap.set(flipRef.current, { scaleX: spec.flip ? -1 : 1 });
      if (bubble.current && spec.bubble && !hidden) gsap.set(bubble.current, { opacity: 1, y: 0 });
    } else {
      const fromX = Number(gsap.getProperty(el, 'x'));
      const dist = Math.abs(target.x - fromX);
      const walking = dist > 30 && !hidden && !p?.hidden;
      const dur = walking ? Math.min(1.7, Math.max(0.7, dist / 650)) : 0.6;
      // Se tourner dans le sens de la marche, puis reprendre l'orientation demandée
      if (walking) {
        const goingLeft = target.x < fromX;
        t.to(flipRef.current, { scaleX: goingLeft ? -1 : 1, duration: 0.15 }, 0);
        const steps = Math.max(2, Math.round(dur / 0.3));
        t.to(body.current, { y: -14, rotation: 3, duration: dur / steps / 2, ease: 'sine.out', yoyo: true, repeat: steps * 2 - 1 }, 0.05);
        t.to(body.current, { rotation: 0, y: 0, duration: 0.15 }, dur);
      }
      t.to(el, { ...target, opacity: hidden ? 0 : 1, duration: dur, ease: walking ? 'power1.inOut' : 'power3.out' }, 0);
      t.to(flipRef.current, { scaleX: spec.flip ? -1 : 1, duration: 0.2 }, dur);
      if (spec.bubble && bubble.current && !hidden) {
        t.to(bubble.current, { opacity: 1, y: 0, duration: 0.35, ease: 'back.out(2)' }, dur + 0.05);
      }
    }
    prev.current = spec;
  }, [spec, reduced, print]);

  if (!spec) return null;
  const side = spec.bubbleSide ?? 'right';

  return (
    <div
      ref={root}
      className="pointer-events-none absolute top-0 left-0 z-30"
      aria-hidden={!spec.bubble}
    >
      {spec.shadow ? (
        <div className="absolute -bottom-3 left-1/2 h-6 w-[70%] -translate-x-1/2 rounded-[50%] bg-black/45 blur-[6px]" />
      ) : null}
      <div ref={body} className="relative h-full w-full" style={{ transformOrigin: '50% 100%' }}>
        <div ref={flipRef} className="relative h-full w-full">
          {POSES.map((p) => (
            <img
              key={p}
              data-pose={p}
              src={asset(`mascotte/baba-jamil-${p}.svg`)}
              alt=""
              draggable={false}
              className="absolute inset-0 h-full w-full select-none"
              style={{ opacity: p === spec.pose ? 1 : 0 }}
            />
          ))}
          {spec.prop === 'clap' ? (
            <div data-mascot-clap className="absolute" style={{ right: '-30%', top: '-26%', width: '46%', transform: 'rotate(12deg)' }}>
              <Clapperboard width={spec.size * 0.46 * RATIO} />
            </div>
          ) : null}
          {spec.prop === 'script' ? (
            <div
              data-mascot-script
              className="screenplay absolute border-[3px] border-ink bg-white p-2 text-[9px] leading-tight text-ink"
              style={{ right: '-22%', top: '2%', width: '42%', height: '52%', transform: 'rotate(9deg)', boxShadow: '5px 5px 0 #121110' }}
            >
              <b>INT. CAFÉ — JOUR</b>
              <br />
              Amira ouvre le café.
            </div>
          ) : null}
        </div>
      </div>
      {spec.bubble ? (
        <div
          ref={bubble}
          role="note"
          className={cx(
            'absolute w-max max-w-[420px] border-[4px] border-ink bg-paper px-6 py-4 text-[28px] leading-snug font-medium text-ink',
            side === 'right' ? 'left-[88%]' : 'right-[88%]',
          )}
          style={{ top: '4%', boxShadow: '8px 8px 0 var(--color-brand-red)' }}
        >
          <span className="sr-only">Baba Jamil : </span>
          {spec.bubble}
          <span
            aria-hidden
            className={cx('absolute top-8 block size-0 border-y-[14px] border-y-transparent', side === 'right' ? '-left-[18px] border-r-[18px] border-r-ink' : '-right-[18px] border-l-[18px] border-l-ink')}
          />
        </div>
      ) : null}
    </div>
  );
}
