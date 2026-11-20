import { useRef } from 'react';
import type { SceneProps } from '@/data/deck';
import { useBeatTimeline } from '@/hooks/useBeatTimeline';
import { asset, Corners, cx, Eyebrow } from '@/components/ui';

/**
 * PROBLÉMATIQUE 1/2 — « Cinq entretiens, le même mur. »
 * Cinq témoignages réels (photos et citations fournies par l'équipe, recueillis avec accord).
 * Chaque témoignage passe en gros plan, puis sa photo s'envole vers l'axe dont il parle :
 * les 4 étapes d'Encadré (Planifier, Tourner, Déclarer, Diffuser) se remplissent de gauche à droite.
 */
interface Witness {
  id: string;
  name: string;
  role: string;
  quote: string;
  photo: string;
  pos: string;
  axes: number[];
}

const WITNESSES: Witness[] = [
  { id: 'hachicha', name: 'Eya Hachicha', role: 'Étudiante en cinéma', quote: '« Le choix des plans, la planification… »', photo: 'temoins/eya-hachicha.jpg', pos: '52% 20%', axes: [0] },
  { id: 'guirat', name: 'Eya Guirat', role: 'Étudiante en cinéma', quote: '« Le cadrage. Et la déclaration de l’IA. »', photo: 'temoins/eya-guirat.jpg', pos: '51% 22%', axes: [1, 2] },
  { id: 'nour', name: 'Nour Elomr Ouni', role: 'Metteur en scène et réalisateur', quote: '« On n’a pas d’encadrants pour mettre en valeur le projet artistique. »', photo: 'premier-pitch/temoin-nour.png', pos: '50% 30%', axes: [3] },
  { id: 'mariem', name: 'Mariem Ben Jeddi', role: 'Jeune réalisatrice', quote: '« L’État ne s’intéresse pas aux jeunes artistes. »', photo: 'premier-pitch/temoin-mariem.png', pos: '50% 30%', axes: [3] },
  { id: 'tarek', name: 'Tarek Ben Abdelfatteh', role: 'Réalisateur · traduit du derja', quote: '« Ceux qui connaissent le chemin ne t’aident pas à avancer. »', photo: 'premier-pitch/temoin-tarek.png', pos: '50% 30%', axes: [3] },
];

const AXES = [
  { name: 'Planifier', need: 'organiser le tournage' },
  { name: 'Tourner', need: 'cadrer' },
  { name: 'Déclarer', need: 'déclarer l’IA' },
  { name: 'Diffuser', need: 'être vu' },
];

/** Géométrie (px de la scène 1920 × 1080) */
const FOCUS = { x: 120, y: 220, size: 320 };
const COL = { x: 100, w: 380, gap: 30, slotY: 650, thumb: 110 };
const colX = (c: number) => COL.x + c * (COL.w + COL.gap);

/** Emplacement de chaque vignette : par axe, dans l'ordre d'arrivée */
const SLOTS: { w: number; axis: number; x: number; y: number }[] = (() => {
  const used = [0, 0, 0, 0];
  const out: { w: number; axis: number; x: number; y: number }[] = [];
  WITNESSES.forEach((w, wi) =>
    w.axes.forEach((a) => {
      out.push({ w: wi, axis: a, x: colX(a) + 14 + used[a] * (COL.thumb + 12), y: COL.slotY });
      used[a]++;
    }),
  );
  return out;
})();

export function Testimonials({ beat }: SceneProps) {
  const ref = useRef<HTMLElement>(null);

  useBeatTimeline(ref, beat, (tl) => {
    tl.from('.head > *', { opacity: 0, y: -20, duration: 0.6, stagger: 0.1 }, 0)
      .from('.axis', { y: 50, opacity: 0, duration: 0.6, stagger: 0.1, ease: 'power3.out' }, 0.3)
      .from('.intro', { opacity: 0, y: 20, duration: 0.6 }, 0.6)
      .addLabel('b0');
    WITNESSES.forEach((w, i) => {
      const at = `b${i}`;
      if (i === 0) tl.to('.intro', { opacity: 0, y: -10, duration: 0.3 }, at);
      else tl.to(`.card-${WITNESSES[i - 1].id}`, { opacity: 0, x: -50, duration: 0.35, ease: 'power2.in' }, at);
      tl.fromTo(`.card-${w.id}`, { opacity: 0, x: 60 }, { opacity: 1, x: 0, duration: 0.5, ease: 'power3.out' }, `${at}+=0.25`)
        .from(`.card-${w.id} .ph`, { scale: 1.12, duration: 0.8, ease: 'power2.out' }, `${at}+=0.25`)
        .from(`.card-${w.id} .q`, { opacity: 0, y: 24, duration: 0.5 }, `${at}+=0.45`);
      // La photo s'envole vers son (ses) axe(s) ; l'axe s'allume
      SLOTS.forEach((s, si) => {
        if (s.w !== i) return;
        const k = FOCUS.size / COL.thumb;
        tl.fromTo(
          `.thumb-${si}`,
          { x: FOCUS.x - s.x, y: FOCUS.y - s.y, scale: k, opacity: 0, rotation: 0 },
          { x: 0, y: 0, scale: 1, opacity: 1, rotation: si % 2 ? 3 : -3, duration: 0.8, ease: 'power3.inOut' },
          `${at}+=1.1`,
        ).to(`.axis-${s.axis} .box`, { borderColor: '#F2F2EF', borderStyle: 'solid', backgroundColor: '#1f1d1b', duration: 0.3 }, `${at}+=1.7`);
      });
      tl.addLabel(`b${i + 1}`);
    });
    // Le mur complet : les quatre axes s'allument, une seule phrase
    const last = `b${WITNESSES.length}`;
    tl.to(`.card-${WITNESSES[WITNESSES.length - 1].id}`, { opacity: 0, x: -50, duration: 0.35, ease: 'power2.in' }, last)
      .to('.axis .box', { borderColor: '#FFC82E', duration: 0.3, stagger: 0.12 }, `${last}+=0.2`)
      .to('.axis .name', { color: '#FFC82E', duration: 0.3, stagger: 0.12 }, `${last}+=0.2`)
      .fromTo('.wall', { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.6 }, `${last}+=0.5`)
      .addLabel(`b${WITNESSES.length + 1}`);
  });

  return (
    <section ref={ref} className="grain absolute inset-0 overflow-hidden bg-ink" aria-label="Problématique : cinq entretiens">
      <Corners inset={40} size={60} stroke={5} color="#3a3733" />
      <div className="head absolute top-[64px] left-[100px]">
        <Eyebrow color="text-gold">Problématique · Cinq entretiens</Eyebrow>
        <h2 className="display mt-3 text-[64px] text-paper">
          Cinq entretiens, <span className="text-gold">le même mur.</span>
        </h2>
      </div>
      <p className="absolute top-[86px] right-[100px] flex items-center gap-3 font-mono text-[22px] tracking-[0.2em] text-brand-red">
        <span className="block size-4 bg-brand-red" /> REC
      </p>

      <p className="intro absolute top-[300px] left-[100px] max-w-[1500px] text-[38px] leading-snug text-muted-on-dark">
        Étudiants, réalisateurs, metteurs en scène : nous leur avons demandé <span className="text-paper">ce qui bloque</span>.
        Leurs réponses tombent sur <span className="text-gold">quatre étapes</span>.
      </p>

      {/* Témoignage en gros plan */}
      {WITNESSES.map((w) => (
        <div key={w.id} className={cx('absolute opacity-0', `card-${w.id}`)} style={{ left: FOCUS.x, top: FOCUS.y, width: 1700 }}>
          <div className="relative overflow-hidden border-[4px] border-ink bg-surface-dark" style={{ width: FOCUS.size, height: FOCUS.size, boxShadow: '14px 14px 0 #FFC82E' }}>
            <img className="ph h-full w-full object-cover" src={asset(w.photo)} alt={w.name} style={{ objectPosition: w.pos }} draggable={false} />
          </div>
          <div className="absolute top-[6px] left-[390px] w-[1260px]">
            <p className="display text-[46px] text-paper">{w.name}</p>
            <p className="mt-1 text-[24px] text-muted-on-dark">{w.role}</p>
            <p className="q display mt-6 text-[54px] leading-[1.08] text-paper">{w.quote}</p>
          </div>
        </div>
      ))}

      <p className="wall display absolute top-[300px] left-[100px] max-w-[1600px] text-[66px] leading-[1.05] text-paper opacity-0">
        À chaque étape, <span className="text-gold">ils avancent seuls.</span>
      </p>

      {/* Les quatre axes */}
      {AXES.map((a, i) => (
        <div key={a.name} className={cx('axis absolute', `axis-${i}`)} style={{ left: colX(i), top: 800, width: COL.w }}>
          <div className="box flex h-[170px] flex-col justify-end border-[3px] border-dashed border-line-dark p-6" style={{ boxShadow: '8px 8px 0 #000' }}>
            <p className="eyebrow text-[17px] text-muted-on-dark">{a.need}</p>
            <p className="name display mt-1 text-[48px] text-paper">{a.name}</p>
          </div>
        </div>
      ))}

      {/* Vignettes (une par témoignage et par axe) */}
      {SLOTS.map((s, si) => {
        const w = WITNESSES[s.w];
        return (
          <div
            key={si}
            className={cx('absolute border-[4px] border-paper bg-surface-dark opacity-0', `thumb-${si}`)}
            style={{ left: s.x, top: s.y, width: COL.thumb, height: COL.thumb, transformOrigin: '0 0', boxShadow: '5px 5px 0 #000' }}
          >
            <img className="h-full w-full object-cover" src={asset(w.photo)} alt="" style={{ objectPosition: w.pos }} draggable={false} />
          </div>
        );
      })}

      <p className="absolute bottom-[34px] left-[100px] text-[19px] text-muted-on-dark">Témoignages réels, recueillis avec l’accord des personnes.</p>
    </section>
  );
}
