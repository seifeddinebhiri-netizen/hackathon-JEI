import { useRef, type ReactNode } from 'react';
import type { SceneProps } from '@/data/deck';
import type { Status } from '@/data/status';
import { useBeatTimeline } from '@/hooks/useBeatTimeline';
import { asset, cx, Eyebrow, Shot, StatusChip } from '@/components/ui';
import { BackendDiagram, MaturityLegend } from '@/components/BackendDiagram';
import { DIAGRAMS, type Diagram } from '@/data/backend';

/**
 * SÉQUENCE 03 — Les quatre modules sur une pellicule. Pour chaque module, deux étapes :
 *  1. la FAÇADE : le photogramme s'agrandit et devient le module (vraies captures, statuts vérifiés) ;
 *  2. L'ENVERS DU DÉCOR : les captures passent en négatif de pellicule, puis le diagramme back-end
 *     se dessine par-dessus (src/data/backend.ts, extrait du dépôt). Même transition pour les 4 modules.
 */
interface Module {
  n: number;
  name: string;
  thumb: string;
  lines: { s: Status; t: string }[];
  callout: ReactNode;
  main: { src: string; alt: string; pos?: string };
  second: { src: string; alt: string; pos?: string; label: string };
  diagram: Diagram;
}

const MODULES: Module[] = [
  {
    n: 1,
    name: 'Planifier',
    thumb: 'captures/parcours-3-decoupage.png',
    lines: [
      { s: 'fait', t: 'Import du scénario : texte, .fountain, PDF, Word' },
      { s: 'fait', t: 'Découpage en scènes, personnages et décors' },
      { s: 'fait', t: 'Suggestions de l’IA : accepter ou refuser' },
      { s: 'fait', t: 'Lieux réels (OpenStreetMap) et météo (Open-Meteo)' },
      { s: 'en-cours', t: 'Calendrier et feuilles de service' },
    ],
    callout: <>« Le créateur garde le dernier mot. »</>,
    main: { src: 'captures/parcours-3-decoupage.png', alt: 'Découpage du scénario proposé par l’IA, à valider' },
    second: { src: 'captures/parcours-7-lieux-proposes.png', alt: 'Lieux proposés pour un décor', label: 'Lieux proposés' },
    diagram: DIAGRAMS.planifier,
  },
  {
    n: 2,
    name: 'Tourner',
    thumb: 'captures/coach.png',
    lines: [
      { s: 'fait', t: 'Caméra du téléphone, mesures sur l’appareil' },
      { s: 'fait', t: 'Visage, horizon, angle, lumière : rien n’est envoyé' },
      { s: 'en-cours', t: 'Plan de cadrage par l’IA : à valider avec une vraie clé' },
      { s: 'prochainement', t: 'Corps entier, essais de terrain et calibration' },
    ],
    callout: <>Prise 01 : une illustration. Aujourd’hui : un prototype qui ouvre la caméra. En démo, le plan est simulé, et l’écran le dit.</>,
    main: { src: 'captures/coach.png', alt: 'Le Coach : décrire la scène, mode démonstration signalé' },
    second: { src: 'premier-pitch/pitch1-coach-illustration.png', alt: 'Illustration du Coach au premier pitch', label: 'Prise 01 · illustration', pos: 'center' },
    diagram: DIAGRAMS.tourner,
  },
  {
    n: 3,
    name: 'Déclarer',
    thumb: 'captures/passeport.png',
    lines: [
      { s: 'fait', t: 'Déclaration département par département' },
      { s: 'fait', t: 'Outils cherchés dans leur documentation publique' },
      { s: 'fait', t: 'Vérification publique du badge et du PDF' },
      { s: 'en-cours', t: 'PDF signé C2PA : certificat de test' },
    ],
    callout: <>« Déclaration fondée sur la documentation publique. Ce n’est pas un avis juridique. »</>,
    main: { src: 'captures/passeport.png', alt: 'Passeport IA : étiquette et déclaration par département' },
    second: { src: 'captures/verification.png', alt: 'Page publique de vérification', label: 'Vérification publique' },
    diagram: DIAGRAMS.declarer,
  },
  {
    n: 4,
    name: 'Diffuser',
    thumb: 'captures/festival-trouver.png',
    lines: [
      { s: 'fait', t: '20 festivals sourcés, classés par compatibilité' },
      { s: 'fait', t: 'Transcription du derja, traduction FR et EN' },
      { s: 'fait', t: 'Relecture ligne par ligne, export .srt verrouillé' },
      { s: 'fait', t: 'Dossiers et page film publique' },
      { s: 'en-cours', t: 'Questions sur le synopsis' },
    ],
    callout: <>Le classement mesure la compatibilité : il ne prédit pas la sélection.</>,
    main: { src: 'captures/festival-trouver.png', alt: 'Kit Festival : trouver mon festival' },
    second: { src: 'captures/festival-sous-titres.png', alt: 'Relecture des sous-titres', label: 'Sous-titres derja → FR, EN' },
    diagram: DIAGRAMS.diffuser,
  },
];

const FRAME_X = [250, 680, 1110, 1540];
/** Filtre neutre des captures (même structure que le négatif : GSAP interpole les valeurs) */
const NEG0 = 'invert(0) sepia(0) contrast(1) brightness(1)';
const FRAME = { y: 880, w: 330, h: 124 };
const PANEL = { x: 90, y: 150, w: 1740, h: 690 };

export function Features({ beat }: SceneProps) {
  const ref = useRef<HTMLElement>(null);

  useBeatTimeline(ref, beat, (tl) => {
    tl.from('.head', { opacity: 0, y: -20, duration: 0.6 }, 0)
      .from('.strip', { x: 1920, duration: 1.2, ease: 'power3.out' }, 0)
      .from('.intro', { opacity: 0, y: 30, duration: 0.7 }, 0.6)
      .addLabel('b0');
    MODULES.forEach((m, i) => {
      const at = `b${2 * i}`;
      const prev = i === 0 ? '.intro' : `.mod-${i}`;
      tl.to(prev, { opacity: 0, x: -60, duration: 0.35, ease: 'power2.in' }, at)
        .to('.frame', { borderColor: '#3a3733', duration: 0.2 }, at)
        .to(`.frame-${m.n}`, { borderColor: '#FFC82E', duration: 0.2 }, at)
        .fromTo(
          '.ghost',
          { x: FRAME_X[i], y: FRAME.y, width: FRAME.w, height: FRAME.h, opacity: 1 },
          { x: PANEL.x, y: PANEL.y, width: PANEL.w, height: PANEL.h, duration: 0.6, ease: 'power3.inOut' },
          `${at}+=0.15`,
        )
        .fromTo(`.mod-${m.n}`, { opacity: 0, x: 40 }, { opacity: 1, x: 0, duration: 0.45 }, `${at}+=0.6`)
        .to('.ghost', { opacity: 0, duration: 0.3 }, `${at}+=0.7`)
        .from(`.mod-${m.n} .li`, { opacity: 0, x: -20, duration: 0.3, stagger: 0.07 }, `${at}+=0.8`)
        .from(`.mod-${m.n} .shot-main`, { y: 40, rotation: 0, duration: 0.6 }, `${at}+=0.65`)
        .from(`.mod-${m.n} .shot-2`, { y: 60, opacity: 0, duration: 0.6 }, `${at}+=0.9`)
        .addLabel(`b${2 * i + 1}`);

      // L'envers du décor : le négatif (≈ 1,3 s), puis le diagramme se construit bloc par bloc
      const back = `b${2 * i + 1}`;
      const shots = `.mod-${m.n} .shot-main, .mod-${m.n} .shot-2`;
      tl.to(`.mod-${m.n} .ftext`, { opacity: 0, x: -30, duration: 0.3, ease: 'power2.in' }, back)
        .to(shots, { filter: 'invert(1) sepia(0.45) contrast(1.25) brightness(0.85)', duration: 0.45, ease: 'power2.inOut' }, back)
        .fromTo(`.mod-${m.n} .neg-grain`, { opacity: 0 }, { opacity: 0.4, duration: 0.25 }, back)
        .to(shots, { opacity: 0.1, scale: 0.97, duration: 0.4, ease: 'power2.out' }, `${back}+=0.45`)
        .to(`.mod-${m.n} .neg-grain`, { opacity: 0.1, duration: 0.4 }, `${back}+=0.45`)
        .fromTo(`.mod-${m.n} .back`, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.25 }, `${back}+=0.5`)
        .from(`.mod-${m.n} .bhead`, { y: -12, opacity: 0, duration: 0.35 }, `${back}+=0.5`)
        .fromTo(`.mod-${m.n} .edge:not(.edge-dashed)`, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.5, stagger: 0.05, ease: 'power1.inOut' }, `${back}+=0.6`)
        .from(`.mod-${m.n} .edge-dashed`, { opacity: 0, duration: 0.3 }, `${back}+=0.9`)
        .from(`.mod-${m.n} .blk`, { opacity: 0, y: 16, duration: 0.3, stagger: 0.08 }, `${back}+=0.6`)
        .addLabel(`b${2 * i + 2}`);
    });
  });

  return (
    <section ref={ref} className="absolute inset-0 overflow-hidden bg-ink" aria-label="Les premières fonctionnalités">
      <div className="head absolute top-[48px] left-[120px] flex items-baseline gap-8">
        <Eyebrow color="text-gold">Séquence 03 · Les premières fonctionnalités</Eyebrow>
        <p className="text-[20px] text-muted-on-dark">Captures réelles du prototype · mode démonstration</p>
      </div>

      <div className="intro absolute top-[300px] left-[120px] w-[1500px]">
        <p className="display text-[96px] text-paper">
          Quatre modules.
          <br />
          <span className="text-gold">Ce qui fonctionne aujourd’hui.</span>
        </p>
        <div className="mt-10 flex gap-5">
          <StatusChip status="fait" />
          <StatusChip status="en-cours" />
          <StatusChip status="prochainement" />
        </div>
      </div>

      {MODULES.map((m) => (
        <div key={m.n} className={cx('mod absolute opacity-0', `mod-${m.n}`)} style={{ left: PANEL.x, top: PANEL.y, width: PANEL.w, height: PANEL.h }}>
          <div className="ftext absolute top-[20px] left-[30px] w-[760px]">
            <p className="eyebrow text-[22px] text-brand-red">Étape {m.n}</p>
            <p className="display text-[92px] text-paper">{m.name}</p>
            <ul className="mt-5 grid list-none gap-[14px] p-0">
              {m.lines.map((l) => (
                <li key={l.t} className="li flex items-center gap-4 text-[25px] leading-tight text-paper">
                  <StatusChip status={l.s} className="w-[230px] shrink-0 justify-start" />
                  {l.t}
                </li>
              ))}
            </ul>
            <p className="li mt-7 border-l-[8px] border-gold pl-6 text-[26px] leading-snug text-gold">{m.callout}</p>
          </div>
          <Shot className="shot-main" src={m.main.src} alt={m.main.alt} position={m.main.pos} style={{ left: 830, top: 20, width: 800, height: 500, transform: 'rotate(-1.5deg)', filter: NEG0 }} />
          <Shot className="shot-2" src={m.second.src} alt={m.second.alt} position={m.second.pos} shadow="red" label={m.second.label} style={{ left: 1260, top: 330, width: 460, height: 288, transform: 'rotate(2deg)', filter: NEG0 }} />
          <div aria-hidden className="neg-grain grain pointer-events-none absolute inset-0 opacity-0" />
          <div className="back invisible absolute inset-0" aria-label={`${m.name} : l’envers du décor`}>
            <div className="bhead absolute top-0 right-0 left-0 flex items-end justify-between">
              <div>
                <p className="eyebrow text-[22px] text-brand-red">Étape {m.n} · back-end</p>
                <p className="display text-[64px] text-paper">
                  {m.name} <span className="text-gold">· l’envers du décor</span>
                </p>
              </div>
              <div className="text-right">
                <MaturityLegend className="justify-end" />
                <p className="mt-1 text-[16px] text-muted-on-dark">Extrait du dépôt : main et feature/scenario-ai</p>
              </div>
            </div>
            <BackendDiagram diagram={m.diagram} />
          </div>
        </div>
      ))}

      <div aria-hidden className="ghost pointer-events-none absolute top-0 left-0 border-[5px] border-gold opacity-0" />

      {/* Pellicule */}
      <div className="strip absolute right-0 left-0 bg-[#0b0b0a]" style={{ top: FRAME.y - 46, height: FRAME.h + 92 }}>
        <div className="perfs absolute top-[12px] right-0 left-0 h-[18px]" style={{ ['--perf-color' as string]: '#3a3733' }} />
        <div className="perfs absolute right-0 bottom-[12px] left-0 h-[18px]" style={{ ['--perf-color' as string]: '#3a3733' }} />
        {MODULES.map((m, i) => (
          <div key={m.n} className={cx('frame absolute overflow-hidden border-[4px] border-line-dark', `frame-${m.n}`)} style={{ left: FRAME_X[i], top: 46, width: FRAME.w, height: FRAME.h }}>
            <img src={asset(m.thumb)} alt="" className="h-full w-full object-cover object-top opacity-70" draggable={false} />
            <span className="eyebrow absolute top-0 right-0 bg-ink px-3 py-1 text-[17px] text-gold">
              {m.n} · {m.name}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
