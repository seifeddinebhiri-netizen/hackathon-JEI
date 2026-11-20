import { useRef } from 'react';
import type { SceneProps } from '@/data/deck';
import { useBeatTimeline } from '@/hooks/useBeatTimeline';
import { Clapperboard } from '@/components/Clapperboard';
import { Logo, PerfBand } from '@/components/ui';

export const GITHUB = 'https://github.com/seifeddinebhiri-netizen/hackathon-JEI';
export const TEAM = ['Oussema Ben Arfa', 'Seif Eddine Bhiri', 'Fatma Barouni', 'Salma Younes'];

/** SÉQUENCE 06 — Retour au plateau. Fin de la prise. */
export function Closing({ beat }: SceneProps) {
  const ref = useRef<HTMLElement>(null);

  useBeatTimeline(ref, beat, (tl) => {
    tl.fromTo('.spot', { opacity: 0, scale: 0.4 }, { opacity: 1, scale: 1, duration: 1, ease: 'power3.out' }, 0)
      .from('.clap', { y: 60, rotation: -12, opacity: 0, duration: 0.7, ease: 'back.out(1.6)' }, 0.4)
      .from('.fin', { opacity: 0, y: 20, duration: 0.5 }, 0.8)
      .addLabel('b0')
      .to('.fin', { opacity: 0, duration: 0.3 }, 'b0')
      .from('.quote', { opacity: 0, y: 30, duration: 0.7 }, 'b0+=0.2')
      .from('.rule', { opacity: 0, y: 20, duration: 0.6 }, '>+0.2')
      .addLabel('b1')
      .to('.quote', { opacity: 0, y: -20, duration: 0.4 }, 'b1')
      .to('.rule', { y: -330, duration: 0.6, ease: 'power3.inOut' }, 'b1')
      .from('.brand > *', { opacity: 0, y: 24, duration: 0.5, stagger: 0.1 }, 'b1+=0.4')
      // Le clap se ferme : fin de la prise
      .to('.clap .clap-arm', { rotation: 0, svgOrigin: '14 74', duration: 0.16, ease: 'power4.in' }, '>+0.1')
      .fromTo('.flash', { opacity: 0.5 }, { opacity: 0, duration: 0.4 }, '>')
      .from('.suivre', { opacity: 0, letterSpacing: '0.6em', duration: 0.8 }, '<')
      .addLabel('b2');
  });

  return (
    <section ref={ref} className="absolute inset-0 overflow-hidden bg-ink" aria-label="À suivre">
      <div aria-hidden className="spot absolute" style={{ left: -100, top: 80, width: 1100, height: 1100, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,200,46,.32), rgba(255,200,46,.06) 55%, transparent 70%)' }} />
      <div aria-hidden className="absolute right-0 bottom-0 left-0 h-[90px]" style={{ background: '#0b0b0a', borderTop: '3px solid #2a2826' }} />

      <div className="clap absolute" style={{ left: 600, top: 420, transform: 'rotate(6deg)' }}>
        <Clapperboard width={400} title="ENCADRÉ" take="PRISE 02" scene="FIN DE LA PRISE" footer="HACKATHON IA ÉTHIQUE 360" />
      </div>
      <p className="fin eyebrow absolute top-[300px] left-[1100px] text-[48px] text-gold">Fin de la prise 02</p>

      <div className="absolute top-[200px] left-[1100px] w-[740px]">
        <p className="quote text-[40px] leading-snug text-paper">
          « Nous n’avons pas seulement imaginé un outil. Nous avons commencé à construire <span className="text-gold">un nouvel accompagnement</span> pour les créateurs. »
        </p>
        <p className="rule display mt-[60px] text-[54px] text-paper">
          L’IA propose.
          <br />
          <span className="text-gold">Le cinéaste décide.</span>
        </p>
      </div>

      <div className="brand absolute top-[430px] left-[1100px] w-[760px]">
        <Logo style={{ width: 460 }} />
        <p className="display mt-6 text-[48px] text-gold">Tourne. Déclare. Fais-toi voir.</p>
        <p className="eyebrow mt-8 text-[20px] text-muted-on-dark">Équipe</p>
        <p className="mt-1 text-[23px] text-paper">{TEAM.join(' · ')}</p>
        <p className="eyebrow mt-6 text-[20px] text-muted-on-dark">Hackathon IA Éthique 360 · JEI INSAT × OIF · 2026</p>
        <a href={GITHUB} target="_blank" rel="noreferrer" className="mt-3 block text-[24px] text-gold underline underline-offset-4">
          {GITHUB.replace('https://', '')}
        </a>
      </div>

      <p className="suivre eyebrow absolute bottom-[130px] left-[600px] text-[34px] text-paper">À suivre…</p>
      <div aria-hidden className="flash pointer-events-none absolute inset-0 bg-paper opacity-0" />
      <PerfBand label="06" style={{ background: 'transparent' }} />
    </section>
  );
}
