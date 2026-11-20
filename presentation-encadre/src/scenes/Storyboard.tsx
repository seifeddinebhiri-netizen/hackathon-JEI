import { useRef } from 'react';
import type { SceneProps } from '@/data/deck';
import { useBeatTimeline } from '@/hooks/useBeatTimeline';
import { asset, cx, Eyebrow, PerfBand } from '@/components/ui';

/**
 * SÉQUENCE 02 — L'atelier : comment un écran a été conçu avant d'être codé.
 * Exemple : la relecture des sous-titres. 1) structure de la page (schéma),
 * 2) maquette du canevas de design (web/docs/maquettes-kit-festival/SousTitres.dc.html),
 * 3) écran réellement développé (capture du prototype).
 */
const STEPS = [
  { t: 'Structure de la page', d: 'Les zones et leur priorité : la ligne à valider d’abord.' },
  { t: 'Maquette de conception', d: 'Canevas de design, données d’exemple, principes posés.' },
  { t: 'Écran développé', d: 'React et TypeScript, relecture réelle ligne par ligne.' },
];
function Wireframe() {
  const box = 'fill-none stroke-ink';
  return (
    <svg viewBox="0 0 1440 900" className="h-full w-full bg-white" aria-label="Structure de la page de relecture des sous-titres">
      <g strokeWidth="4" strokeDasharray="14 10">
        <rect x="0" y="0" width="1440" height="64" className="fill-ink" />
        <rect x="64" y="110" width="1312" height="150" className={box} />
        <rect x="64" y="300" width="840" height="470" className={box} />
        <rect x="944" y="300" width="432" height="560" className={box} />
        <rect x="64" y="800" width="470" height="60" className={box} />
        <rect x="980" y="430" width="360" height="60" className={box} />
        <rect x="980" y="520" width="360" height="60" className={box} />
        <rect x="980" y="620" width="360" height="110" className="fill-gold-soft stroke-ink" />
      </g>
      <g fontFamily="JetBrains Mono, monospace" fontSize="30" fill="#55524C" letterSpacing="2">
        <text x="96" y="170">EN-TÊTE : FILM · LANGUES · BROUILLON IA</text>
        <text x="96" y="220" fontSize="24">progression des lignes validées</text>
        <text x="300" y="545">VIDÉO DU FILM</text>
        <text x="976" y="350">LIGNE À VALIDER</text>
        <text x="976" y="390" fontSize="22">timecode · confiance</text>
        <text x="1000" y="470" fontSize="22">français</text>
        <text x="1000" y="560" fontSize="22">anglais</text>
        <text x="1000" y="670" fontSize="22">avertissement</text>
        <text x="96" y="840" fontSize="22">ligne précédente / suivante</text>
      </g>
    </svg>
  );
}

export function Storyboard({ beat }: SceneProps) {
  const ref = useRef<HTMLElement>(null);

  useBeatTimeline(ref, beat, (tl) => {
    const scan = (layer: string, step: string, at: string) => {
      tl.fromTo(layer, { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: 1.1, ease: 'power2.inOut' }, at)
        .fromTo('.scan', { x: 0, opacity: 1 }, { x: 1200, duration: 1.1, ease: 'power2.inOut' }, at)
        .set('.scan', { opacity: 0 })
        .to('.step', { backgroundColor: '#FFFFFF', color: '#55524C', duration: 0.3 }, at)
        .to(step, { backgroundColor: '#FFC82E', color: '#121110', duration: 0.3 }, at);
    };
    tl.from('.head', { opacity: 0, y: -20, duration: 0.6 }, 0)
      .from('.board', { y: 60, rotation: -2, opacity: 0, duration: 0.8 }, 0.1)
      .from('.step', { x: 60, opacity: 0, duration: 0.5, stagger: 0.12 }, 0.5)
      .addLabel('b0');
    scan('.layer-2', '.step-2', 'b0');
    tl.addLabel('b1');
    scan('.layer-3', '.step-3', 'b1');
    tl.from('.real-note', { opacity: 0, y: 10, duration: 0.4 }, '>-0.2').addLabel('b2');
  });

  return (
    <section ref={ref} className="paper-tex absolute inset-0 overflow-hidden text-ink" aria-label="Du storyboard à l’interface">
      <div className="head absolute top-[60px] left-[100px]">
        <Eyebrow>Séquence 02 · Du storyboard à l’interface</Eyebrow>
        <h2 className="display mt-3 text-[70px]">De la maquette à l’écran</h2>
      </div>

      {/* Tableau central : structure → maquette → interface réelle */}
      <div className="board absolute top-[220px] left-[100px] h-[750px] w-[1200px] border-[5px] border-ink bg-white" style={{ boxShadow: '14px 14px 0 #E4202E' }}>
        <div className="absolute inset-0">
          <Wireframe />
        </div>
        <img className="layer-2 absolute inset-0 h-full w-full object-cover object-top" src={asset('captures/maquette-SousTitres.png')} alt="Maquette de la relecture des sous-titres (canevas de design)" draggable={false} style={{ clipPath: 'inset(0 100% 0 0)' }} />
        <img className="layer-3 absolute inset-0 h-full w-full object-cover object-top" src={asset('captures/festival-sous-titres.png')} alt="Écran développé : relecture des sous-titres" draggable={false} style={{ clipPath: 'inset(0 100% 0 0)' }} />
        <p className="real-note eyebrow absolute right-3 bottom-3 bg-gold px-3 py-1 text-[15px] text-ink">Capture réelle · données de démo « Dar Hmeti »</p>
        <div aria-hidden className="scan absolute top-0 bottom-0 left-0 w-[6px] bg-gold opacity-0" style={{ boxShadow: '0 0 24px 6px rgba(255,200,46,.7)' }} />
      </div>

      {/* Les trois étapes, en colonne */}
      <ol className="absolute top-[220px] left-[1370px] m-0 grid w-[450px] list-none gap-6 p-0">
        {STEPS.map((st, i) => (
          <li
            key={st.t}
            className={cx('step border-[3px] border-ink p-6', `step-${i + 1}`)}
            style={{ background: i === 0 ? '#FFC82E' : '#FFFFFF', color: i === 0 ? '#121110' : '#55524C', boxShadow: '8px 8px 0 #121110' }}
          >
            <p className="eyebrow text-[20px]">Étape {i + 1}</p>
            <p className="display mt-1 text-[34px]">{st.t}</p>
            <p className="mt-2 text-[21px] leading-snug">{st.d}</p>
          </li>
        ))}
      </ol>
      <PerfBand dark label="02" />
    </section>
  );
}
