import { useLayoutEffect, useRef, type RefObject } from 'react';
import gsap from 'gsap';
import type { TransitionType } from '@/data/deck';
import { Clapperboard } from '@/components/Clapperboard';
import { LENS } from '@/scenes/Ethics';
import { STAGE_H, STAGE_W } from '@/hooks/deckEnv';

/**
 * Transitions cinématographiques. Chacune a deux temps :
 *  1. couvrir l'écran (onCover : la scène suivante est montée à ce moment-là) ;
 *  2. révéler la nouvelle scène (onDone).
 * Seuls transform et opacity sont animés. Animations réduites : simple fondu au noir.
 */
export interface TransitionRun {
  id: number;
  type: TransitionType;
}

export function TransitionLayer({
  run,
  reduced,
  sceneLayer,
  onCover,
  onDone,
}: {
  run: TransitionRun | null;
  reduced: boolean;
  sceneLayer: RefObject<HTMLDivElement | null>;
  onCover: () => void;
  onDone: () => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const cb = useRef({ onCover, onDone });
  cb.current = { onCover, onDone };

  useLayoutEffect(() => {
    const el = root.current;
    const layerEl = sceneLayer.current;
    if (!run || !el) return;
    const q = gsap.utils.selector(el);
    const tl = gsap.timeline({ onComplete: () => cb.current.onDone() });
    const cover = () => cb.current.onCover();
    gsap.set(el, { display: 'block' });
    gsap.set(q('.layer'), { autoAlpha: 0 });

    const type: TransitionType = reduced ? 'cut' : run.type;

    if (type === 'cut') {
      tl.fromTo(q('.t-black'), { autoAlpha: 0 }, { autoAlpha: 1, duration: reduced ? 0.15 : 0.25 })
        .call(cover)
        .to(q('.t-black'), { autoAlpha: 0, duration: reduced ? 0.2 : 0.35 }, '+=0.05');
    }

    if (type === 'clap') {
      // Le clap part de la main de Baba Jamil, grandit, se ferme : noir, puis le titre.
      const clap = q('.t-clap')[0];
      const arm = clap.querySelector('.clap-arm');
      gsap.set(arm, { rotation: -32, svgOrigin: '14 74' });
      // L'accessoire quitte la main de Baba Jamil : on cache sa version tenue
      tl.set('[data-mascot-clap]', { autoAlpha: 0 }, 0);
      tl.set(clap, { autoAlpha: 1, x: -560, y: 300, scale: 0.35, rotation: 8 })
        .to(q('.t-black'), { autoAlpha: 0.75, duration: 0.35 }, 0)
        .to(clap, { x: 0, y: 0, scale: 1, rotation: 0, duration: 0.45, ease: 'power3.out' }, 0)
        .to(arm, { rotation: 0, duration: 0.14, ease: 'power4.in' }, '+=0.05')
        .set(q('.t-flash'), { autoAlpha: 0.9 })
        .to(q('.t-flash'), { autoAlpha: 0, duration: 0.12 })
        .set(q('.t-black'), { autoAlpha: 1 }, '<')
        .set(clap, { autoAlpha: 0 })
        .call(cover, [], '+=0.12')
        .to(q('.t-black'), { autoAlpha: 0, duration: 0.45 }, '+=0.05');
    }

    if (type === 'film') {
      // La lumière du projecteur s'éteint, la pellicule défile, un photogramme devient l'écran.
      const strip = q('.t-strip')[0];
      const frame = q('.t-frame-c')[0];
      tl.to(q('.t-black'), { autoAlpha: 0.85, duration: 0.3 })
        .set(strip, { autoAlpha: 1, x: STAGE_W })
        .to(strip, { x: -380, duration: 0.6, ease: 'power3.out' })
        .set(q('.t-zoom'), { autoAlpha: 1, x: 760, y: 400, width: 400, height: 280 })
        .to(q('.t-zoom'), { x: 0, y: 0, width: STAGE_W, height: STAGE_H, duration: 0.45, ease: 'power3.in' })
        .set([strip, frame], { autoAlpha: 0 })
        .set(q('.t-black'), { autoAlpha: 0 })
        .call(cover)
        .to(q('.t-zoom'), { autoAlpha: 0, duration: 0.4 }, '+=0.05');
    }

    if (type === 'script') {
      // La feuille du scénario quitte la main de Baba Jamil et se déploie en plein écran.
      const sheet = q('.t-sheet')[0];
      tl.set('[data-mascot-script]', { autoAlpha: 0 }, 0);
      tl.set(sheet, { autoAlpha: 1, x: 1660, y: 720, width: 150, height: 200, rotation: 9 })
        .to(sheet, { x: 0, y: 0, width: STAGE_W, height: STAGE_H, rotation: 0, duration: 0.85, ease: 'power3.inOut' })
        .to(q('.t-sheet-text'), { autoAlpha: 0, duration: 0.25 }, '-=0.15')
        .call(cover)
        .to(sheet, { autoAlpha: 0, duration: 0.45 }, '+=0.05');
    }

    if (type === 'band') {
      // Bandes obliques rouge et or (le motif de la couverture du premier pitch)
      tl.set(q('.t-band'), { autoAlpha: 1, xPercent: -130 })
        .to(q('.t-band'), { xPercent: 0, duration: 0.55, ease: 'power3.in', stagger: 0.06 })
        .call(cover)
        .to(q('.t-band'), { xPercent: 130, duration: 0.6, ease: 'power3.out', stagger: 0.06 }, '+=0.1');
    }

    if (type === 'iris') {
      // Le disque jaune de l'objectif grandit et devient la lumière du plateau.
      const d = q('.t-iris')[0];
      const r = LENS.r - 62;
      tl.set(d, { autoAlpha: 1, x: LENS.cx - r, y: LENS.cy - r, width: r * 2, height: r * 2, scale: 1 })
        .to(d, { scale: 8, duration: 0.7, ease: 'power3.in' })
        .call(cover)
        .to(d, { autoAlpha: 0, duration: 0.7, ease: 'power2.out' }, '+=0.05');
    }

    tl.set(el, { display: 'none' });
    return () => {
      tl.kill();
      if (layerEl) gsap.set(layerEl, { clearProps: 'transform' });
    };
  }, [run, reduced, sceneLayer]);

  return (
    <div ref={root} aria-hidden className="pointer-events-none absolute inset-0 z-40" style={{ display: 'none' }}>
      <div className="layer t-black absolute inset-0 bg-black" />

      <div className="layer t-clap absolute" style={{ left: STAGE_W / 2 - 320, top: STAGE_H / 2 - 260 }}>
        <Clapperboard width={640} title="ENCADRÉ" take="PRISE 02" scene="DERRIÈRE LA CAM" />
      </div>
      <div className="layer t-flash absolute inset-0 bg-paper" />

      <div className="layer t-strip absolute top-[360px] left-0 flex h-[360px] w-[2400px] items-center gap-8 bg-[#0b0b0a] px-8">
        <div className="perfs absolute top-[14px] right-0 left-0 h-[20px]" style={{ ['--perf-color' as string]: '#3a3733' }} />
        <div className="perfs absolute right-0 bottom-[14px] left-0 h-[20px]" style={{ ['--perf-color' as string]: '#3a3733' }} />
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className={i === 3 ? 't-frame-c h-[260px] w-[370px] shrink-0 bg-[#161513]' : 'h-[260px] w-[370px] shrink-0 border-2 border-line-dark bg-[#121110]'} />
        ))}
      </div>
      <div className="layer t-zoom absolute top-0 left-0 border-[6px] border-gold bg-[#161513]" />

      <div className="layer t-sheet screenplay absolute top-0 left-0 overflow-hidden bg-paper text-ink" style={{ boxShadow: '12px 12px 0 #121110' }}>
        <div className="t-sheet-text absolute top-[12%] left-[18%] w-[64%] text-[34px] leading-relaxed">
          <p className="font-bold">INT. ATELIER ENCADRÉ — JOUR</p>
          <p>L’équipe épingle les maquettes au mur.</p>
          <p className="mt-6 text-center font-bold">BABA JAMIL</p>
          <p className="text-center">Avant le code, on dessine.</p>
        </div>
      </div>

      {['#E4202E', '#FFC82E', '#121110'].map((c, i) => (
        <div key={c} className="layer t-band absolute top-[-10%] h-[120%]" style={{ left: `${-10 + i * 4}%`, width: '120%', background: c, transform: 'skewX(-14deg)', zIndex: i }} />
      ))}

      <div className="layer t-iris absolute top-0 left-0 rounded-full bg-gold" />
    </div>
  );
}
