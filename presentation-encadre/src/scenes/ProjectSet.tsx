import { useRef } from 'react';
import type { SceneProps } from '@/data/deck';
import { useBeatTimeline } from '@/hooks/useBeatTimeline';
import { asset, cx, Eyebrow, PerfBand } from '@/components/ui';

/** SÉQUENCE 01 — Le plateau : les quatre panneaux du premier pitch s'allument. */
const PANELS = [
  { n: 1, name: 'Planifier', pose: 'planifier', gold: false, line: 'Scénario, lieux, météo, calendrier' },
  { n: 2, name: 'Tourner', pose: 'tourner', gold: true, line: 'Le Coach de cadrage' },
  { n: 3, name: 'Déclarer', pose: 'declarer', gold: false, line: 'Le Passeport IA' },
  { n: 4, name: 'Diffuser', pose: 'diffuser', gold: true, line: 'Le Kit Festival' },
];

export function ProjectSet({ beat }: SceneProps) {
  const ref = useRef<HTMLElement>(null);

  useBeatTimeline(ref, beat, (tl) => {
    tl.from('.floor', { opacity: 0, duration: 0.8 }, 0)
      .from('.head', { opacity: 0, y: -24, duration: 0.7 }, 0.1)
      .from('.panel', { y: 120, opacity: 0, duration: 0.8, stagger: 0.1, ease: 'power3.out' }, 0.2)
      // Le panneau PLANIFIER s'illumine en premier
      .to('.p1 .dim', { opacity: 0, duration: 0.5 }, 1.0)
      .to('.p1-beam', { opacity: 1, duration: 0.5 }, 1.0)
      .addLabel('b0')
      .to('.p2 .dim', { opacity: 0, duration: 0.4 }, 'b0')
      .to('.p2-beam', { opacity: 1, duration: 0.4 }, 'b0')
      .to('.p3 .dim', { opacity: 0, duration: 0.4 }, 'b0+=0.35')
      .to('.p3-beam', { opacity: 1, duration: 0.4 }, 'b0+=0.35')
      .to('.p4 .dim', { opacity: 0, duration: 0.4 }, 'b0+=0.7')
      .to('.p4-beam', { opacity: 1, duration: 0.4 }, 'b0+=0.7')
      .from('.lead', { opacity: 0, y: 20, duration: 0.6 }, 'b0+=1')
      .addLabel('b1')
      .to('.panel', { y: -20, duration: 0.6, stagger: 0.05 }, 'b1')
      .from('.lines', { opacity: 0, y: 20, duration: 0.5, stagger: 0.08 }, 'b1+=0.2')
      .addLabel('b2');
  });

  return (
    <section ref={ref} className="absolute inset-0 overflow-hidden bg-ink" aria-label="Le projet prend forme">
      {/* Sol du plateau */}
      <div
        aria-hidden
        className="floor absolute right-0 bottom-0 left-0 h-[300px]"
        style={{ background: 'linear-gradient(180deg, #1f1d1b 0%, #121110 100%)', borderTop: '3px solid #3a3733' }}
      />
      {/* Faisceaux de projecteurs, un par panneau */}
      {PANELS.map((p, i) => (
        <div
          key={p.n}
          aria-hidden
          className={cx(`p${p.n}-beam`, 'absolute top-0 opacity-0')}
          style={{
            left: 200 + i * 390,
            width: 420,
            height: 980,
            background: 'linear-gradient(180deg, rgba(255,200,46,.30), rgba(255,200,46,.04) 75%, transparent)',
            clipPath: 'polygon(42% 0, 58% 0, 100% 100%, 0 100%)',
          }}
        />
      ))}

      <div className="head absolute top-[70px] left-[120px]">
        <Eyebrow color="text-gold">Séquence 01 · Le projet prend forme</Eyebrow>
        <h2 className="display mt-4 text-[76px] text-paper">
          D’une vision à un <span className="text-gold">véritable parcours</span> de création.
        </h2>
      </div>

      <div className="absolute top-[330px] left-[230px] flex gap-[50px]">
        {PANELS.map((p) => (
          <div key={p.n} className={cx('panel relative', `p${p.n}`)} style={{ width: 340 }}>
            <div className={cx('relative h-[400px] border-[4px] border-ink px-6 pt-5', p.gold ? 'bg-gold' : 'bg-paper')}>
              <p className={cx('eyebrow text-[22px]', p.gold ? 'text-ink' : 'text-brand-red')}>Étape {p.n}</p>
              <img src={asset(`mascotte/baba-jamil-${p.pose}.svg`)} alt="" className="mx-auto mt-2 h-[215px]" draggable={false} />
              <p className="display mt-3 text-center text-[46px] text-ink">{p.name}</p>
              <div className="dim absolute inset-0 bg-ink/75" />
            </div>
            <p className="lines mt-6 text-center text-[24px] text-muted-on-dark">{p.line}</p>
          </div>
        ))}
      </div>

      <p className="lead absolute top-[200px] left-[120px] max-w-[1600px] text-[30px] leading-snug text-muted-on-dark">
        Encadré accompagne les jeunes réalisateurs, <span className="text-gold">de la préparation du tournage jusqu’à la diffusion</span> de leur film.
      </p>
      <PerfBand label="01" style={{ opacity: 0.9 }} />
    </section>
  );
}
