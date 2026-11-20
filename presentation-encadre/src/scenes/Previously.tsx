import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import type { SceneProps } from '@/data/deck';
import { useDeckEnv } from '@/hooks/deckEnv';
import { useBeatTimeline } from '@/hooks/useBeatTimeline';
import { asset } from '@/components/ui';

/**
 * SÉQUENCE 00 — « Précédemment dans Encadré ».
 * Les souvenirs sont de VRAIES images : pages du premier pitch et photos des témoignages
 * (extraites du PDF par scripts/extract-pdf.mjs). Aucun visage recréé.
 */
const FRAMES: { src: string; alt: string; w: number; caption: string }[] = [
  { src: 'premier-pitch/page-01.png', alt: 'Couverture du premier pitch', w: 480, caption: 'Prise 01' },
  { src: 'premier-pitch/page-02.png', alt: 'Le problème', w: 480, caption: 'Le problème' },
  { src: 'premier-pitch/temoin-nour.png', alt: 'Nour Elomr Ouni', w: 270, caption: 'Nour' },
  { src: 'premier-pitch/temoin-mariem.png', alt: 'Mariem Ben Jeddi', w: 270, caption: 'Mariem' },
  { src: 'premier-pitch/temoin-tarek.png', alt: 'Tarek Ben Abdelfatteh', w: 270, caption: 'Tarek' },
  { src: 'premier-pitch/el-teatro.png', alt: 'Devant El Teatro, Tunis', w: 352, caption: 'El Teatro, Tunis' },
  { src: 'premier-pitch/page-05.png', alt: 'Les quatre étapes', w: 480, caption: 'Quatre étapes' },
  { src: 'premier-pitch/page-10.png', alt: 'Éthique à 360°', w: 480, caption: 'Éthique 360' },
  { src: 'premier-pitch/page-13.png', alt: 'Merci', w: 480, caption: 'Merci' },
];

function Strip() {
  return (
    <div className="flex h-full items-center gap-6 px-6">
      {FRAMES.map((f) => (
        <figure key={f.src} className="relative m-0 shrink-0" style={{ width: f.w, height: 270 }}>
          <img
            src={asset(f.src)}
            alt={f.alt}
            className="h-full w-full object-cover"
            style={{ filter: 'sepia(.35) saturate(.75) contrast(1.05) brightness(.92)' }}
            draggable={false}
          />
          <figcaption className="eyebrow absolute bottom-2 left-2 bg-ink/80 px-2 py-1 text-[14px] text-gold">{f.caption}</figcaption>
        </figure>
      ))}
    </div>
  );
}

export function Previously({ beat }: SceneProps) {
  const ref = useRef<HTMLElement>(null);
  const { reduced, print } = useDeckEnv();

  // Défilement lent des souvenirs, indépendant des étapes (limité à cette scène)
  useLayoutEffect(() => {
    if (reduced || print) return;
    const ctx = gsap.context(() => {
      gsap.to('.reel-inner', { x: -1500, duration: 26, ease: 'none' });
    }, ref);
    return () => ctx.revert();
  }, [reduced, print]);

  useBeatTimeline(ref, beat, (tl) => {
    // Projecteur qui s'allume : un seul vacillement, pas d'effet permanent
    tl.fromTo('.flicker', { opacity: 0 }, { opacity: 0.22, duration: 0.08, repeat: 3, yoyo: true, ease: 'none' }, 0)
      .set('.flicker', { opacity: 0 })
      .from('.eyebrow-top', { opacity: 0, y: -20, duration: 0.6 }, 0.2)
      .from('.reel', { xPercent: 30, opacity: 0, duration: 1.4, ease: 'power2.out' }, 0.1)
      .addLabel('b0', 1.6)
      .from('.line-1', { opacity: 0, y: 40, duration: 0.8 }, 'b0')
      .addLabel('b1')
      .to('.reel', { opacity: 0.35, duration: 0.6 }, 'b1')
      .to('.line-1', { opacity: 0.45, duration: 0.6 }, 'b1')
      .from('.line-2', { opacity: 0, y: 40, duration: 0.8 }, 'b1+=0.3')
      .addLabel('b2');
  });

  return (
    <section ref={ref} className="grain absolute inset-0 overflow-hidden bg-ink" aria-label="Précédemment dans Encadré">
      {/* Lumière du projecteur */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{ background: 'radial-gradient(ellipse 70% 55% at 50% 42%, rgba(255,200,46,.10), transparent 70%)' }}
      />
      <p className="eyebrow-top eyebrow absolute top-[90px] left-[120px] text-[26px] text-gold">Précédemment dans encadré</p>
      <p className="eyebrow-top eyebrow absolute top-[90px] right-[120px] text-[20px] text-muted-on-dark">
        Prise 01 · Tunis · novembre 2026
      </p>

      {/* Pellicule des souvenirs */}
      <div className="reel absolute right-0 left-0 top-[230px] h-[380px] bg-[#0b0b0a]">
        <div className="perfs absolute top-[18px] right-0 left-0 h-[22px]" style={{ ['--perf-color' as string]: '#3a3733' }} />
        <div className="perfs absolute right-0 bottom-[18px] left-0 h-[22px]" style={{ ['--perf-color' as string]: '#3a3733' }} />
        <div className="reel-inner absolute top-[55px] left-0 h-[270px]">
          <Strip />
        </div>
      </div>

      <div className="absolute right-[120px] bottom-[150px] left-[560px]">
        <p className="line-1 display text-[84px] text-paper">
          Précédemment… nous avions <span className="text-gold">une vision.</span>
        </p>
        <p className="line-2 display mt-6 text-[84px] text-paper">
          Aujourd’hui, elle <span className="text-brand-red">prend forme.</span>
        </p>
      </div>
      <p className="absolute bottom-[60px] left-[560px] text-[20px] text-muted-on-dark">
        Témoignages réels, recueillis avec l’accord des personnes (premier pitch).
      </p>

      <div aria-hidden className="flicker pointer-events-none absolute inset-0 bg-paper opacity-0" />
    </section>
  );
}
