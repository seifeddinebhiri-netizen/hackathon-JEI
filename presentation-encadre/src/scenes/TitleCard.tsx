import { useRef } from 'react';
import type { SceneProps } from '@/data/deck';
import { useBeatTimeline } from '@/hooks/useBeatTimeline';
import { Corners, PerfBand } from '@/components/ui';

/** Carton de titre, composé comme la couverture du premier pitch (noir, bande rouge oblique, aplat jaune). */
export function TitleCard({ beat }: SceneProps) {
  const ref = useRef<HTMLElement>(null);

  useBeatTimeline(ref, beat, (tl) => {
    tl.from('.panel-gold', { xPercent: 100, duration: 0.9, ease: 'power4.out' }, 0)
      .from('.band-red', { xPercent: 160, duration: 0.9, ease: 'power4.out' }, 0.05)
      .from('.corners', { opacity: 0, scale: 1.08, duration: 0.6 }, 0.2)
      .from('.t-line', { yPercent: 110, duration: 0.9, stagger: 0.12, ease: 'power4.out' }, 0.25)
      .from('.t-sub', { opacity: 0, y: 20, duration: 0.6 }, 0.9)
      .from('.t-open span', { opacity: 0, y: 16, duration: 0.5, stagger: 0.35 }, 1.2)
      .addLabel('b0')
      .to('.t-open', { opacity: 0, y: -10, duration: 0.4 }, 'b0')
      .from('.t-quote', { opacity: 0, y: 30, duration: 0.8 }, 'b0+=0.3')
      .from('.t-rule', { opacity: 0, x: -30, duration: 0.6 }, '>-0.2')
      .addLabel('b1');
  });

  return (
    <section ref={ref} className="absolute inset-0 overflow-hidden bg-ink" aria-label="Encadré, prise 02 : derrière la caméra">
      {/* Aplat jaune + bande rouge, comme la couverture du premier pitch */}
      <div aria-hidden className="panel-gold absolute top-0 right-0 bottom-0 w-[640px] bg-gold" style={{ clipPath: 'polygon(22% 0, 100% 0, 100% 100%, 0 100%)' }} />
      <div aria-hidden className="band-red absolute top-0 bottom-0 right-[566px] w-[100px] bg-brand-red" style={{ clipPath: 'polygon(78% 0, 100% 0, 22% 100%, 0 100%)' }} />

      <div className="absolute top-[110px] left-[120px] w-[1150px]">
        <div className="corners relative px-[56px] py-[44px]">
          <Corners inset={0} size={70} stroke={8} square />
          <p className="eyebrow mb-6 text-[26px] text-gold">Hackathon IA Éthique 360 · JEI INSAT × OIF · 2026</p>
          <h1 className="m-0">
            <span className="block overflow-hidden">
              <span className="t-line display block text-[150px] text-paper">
                encadr<span className="text-gold">é</span>
              </span>
            </span>
            <span className="block overflow-hidden">
              <span className="t-line display block text-[150px] text-paper">— Prise 02</span>
            </span>
          </h1>
          <p className="t-sub eyebrow mt-8 text-[44px] text-gold">Derrière la caméra</p>
        </div>

        <p className="t-open mt-14 text-[40px] leading-snug text-paper">
          <span>Une idée. </span>
          <span>Un premier prototype. </span>
          <span className="text-gold">Et maintenant, les coulisses.</span>
        </p>
        <div className="t-quote absolute top-[560px] left-0 w-[1120px] border-l-[10px] border-brand-red pl-10">
          <p className="text-[36px] leading-snug text-paper">
            « La première fois, nous vous avons montré <b>pourquoi</b> Encadré devait exister. Aujourd’hui, nous vous montrons{' '}
            <b className="text-gold">comment</b> nous lui avons donné vie. »
          </p>
        </div>
        <p className="t-rule display absolute top-[780px] left-0 text-[44px] text-paper">
          L’IA propose, <span className="text-gold">le cinéaste décide.</span>
        </p>
      </div>
      <PerfBand label="00" />
    </section>
  );
}
