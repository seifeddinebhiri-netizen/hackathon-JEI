import { useRef } from 'react';
import type { SceneProps } from '@/data/deck';
import { useBeatTimeline } from '@/hooks/useBeatTimeline';
import { cx, Eyebrow } from '@/components/ui';

/**
 * SÉQUENCE 05 — Devant l'objectif. Trois principes, chacun avec des engagements DÉJÀ présents
 * dans le code (vérifiés), puis les limites que nous disons ouvertement.
 */
const PRINCIPLES = [
  {
    id: 'crea',
    word: 'Créativité',
    items: [
      'L’IA ne réécrit ni l’histoire, ni les dialogues, ni les personnages',
      'Chaque proposition arrive en « Brouillon IA : à valider »',
      'Le synopsis reste celui du cinéaste',
    ],
  },
  {
    id: 'trans',
    word: 'Transparence',
    items: [
      'Passeport IA : « non divulgué » est un statut accepté',
      'Chaque festival affiche sa source et sa date de vérification',
      'Au-delà de 14 jours, aucune météo inventée',
    ],
  },
  {
    id: 'ctrl',
    word: 'Contrôle humain',
    items: [
      'Sous-titres : export verrouillé tant qu’une ligne n’est pas validée',
      'Planning : alerte si des scènes ne sont pas relues',
      'Images du Coach traitées sur le téléphone, jamais envoyées',
      'Mes données : export et suppression',
    ],
  },
];
const LIMITS = [
  'Offre gratuite de l’IA : nous ne promettons pas « aucun entraînement »',
  'Signature C2PA : certificat de test, pas encore d’autorité reconnue',
  'Derja : qualité de transcription à mesurer sur nos extraits',
  'Seuils du Coach : réglages de départ, à calibrer sur le terrain',
];

export const LENS = { cx: 960, cy: 520, r: 330 };

export function Ethics({ beat }: SceneProps) {
  const ref = useRef<HTMLElement>(null);

  useBeatTimeline(ref, beat, (tl) => {
    tl.from('.head', { opacity: 0, y: -20, duration: 0.5 }, 0)
      .from('.lens', { scale: 0.6, opacity: 0, rotation: -40, svgOrigin: `${LENS.cx} ${LENS.cy}`, duration: 0.9, ease: 'power3.out' }, 0.1)
      .from('.iris-blades', { rotation: 60, svgOrigin: `${LENS.cx} ${LENS.cy}`, duration: 1.2, ease: 'power2.out' }, 0.2)
      .addLabel('b0');
    PRINCIPLES.forEach((p, i) => {
      const at = `b${i}`;
      if (i > 0) {
        tl.to(`.word-${PRINCIPLES[i - 1].id}`, { opacity: 0, scale: 0.6, duration: 0.3 }, at).to(`.eng-${PRINCIPLES[i - 1].id}`, { opacity: 0, x: 40, duration: 0.3 }, at);
      }
      tl.fromTo(`.word-${p.id}`, { opacity: 0, scale: 1.6 }, { opacity: 1, scale: 1, duration: 0.5, ease: 'power3.out' }, `${at}+=0.25`)
        .fromTo(`.eng-${p.id}`, { opacity: 0, x: 40 }, { opacity: 1, x: 0, duration: 0.4 }, `${at}+=0.35`)
        .from(`.eng-${p.id} li`, { opacity: 0, y: 14, duration: 0.3, stagger: 0.12 }, `${at}+=0.45`)
        .fromTo(`.tag-${p.id}`, { opacity: 0.25 }, { opacity: 1, duration: 0.3 }, `${at}+=0.3`)
        .fromTo(`.tag-${p.id} .tick`, { scale: 0 }, { scale: 1, duration: 0.3, ease: 'back.out(3)' }, `${at}+=0.4`)
        .addLabel(`b${i + 1}`);
    });
    // Les trois principes se rejoignent dans l'objectif, qui devient un cercle jaune
    tl.to('.word-ctrl, .eng-ctrl', { opacity: 0, duration: 0.3 }, 'b3')
      .fromTo('.disc', { scale: 0, svgOrigin: `${LENS.cx} ${LENS.cy}` }, { scale: 1, svgOrigin: `${LENS.cx} ${LENS.cy}`, duration: 0.7, ease: 'power3.inOut' }, 'b3+=0.2')
      .fromTo('.disc-text', { opacity: 0 }, { opacity: 1, duration: 0.4 }, '>-0.2')
      .fromTo('.limits', { opacity: 0, x: 40 }, { opacity: 1, x: 0, duration: 0.5 }, 'b3+=0.4')
      .from('.limits li', { opacity: 0, y: 12, duration: 0.3, stagger: 0.1 }, '>-0.2')
      .addLabel('b4');
  });

  const { cx: X, cy: Y, r: R } = LENS;
  return (
    <section ref={ref} className="absolute inset-0 overflow-hidden bg-ink" aria-label="L’éthique au cœur du projet">
      <div className="head absolute top-[56px] left-[100px]">
        <Eyebrow color="text-gold">Séquence 05 · L’éthique au cœur du projet</Eyebrow>
        <h2 className="display mt-3 text-[60px] text-paper">Devant l’objectif</h2>
      </div>

      {/* Les trois principes, cochés au fur et à mesure */}
      <ul className="absolute top-[300px] left-[100px] m-0 grid list-none gap-6 p-0">
        {PRINCIPLES.map((p) => (
          <li key={p.id} className={cx('flex items-center gap-4 opacity-25', `tag-${p.id}`)}>
            <span className="tick flex size-12 items-center justify-center bg-gold text-[28px] font-bold text-ink">✓</span>
            <span className="eyebrow text-[30px] text-paper">{p.word}</span>
          </li>
        ))}
      </ul>

      {/* Objectif (rappel de l'œil de Baba Jamil) */}
      <svg aria-hidden viewBox="0 0 1920 1080" className="pointer-events-none absolute inset-0 h-full w-full">
        <defs>
          <radialGradient id="glass" cx="40%" cy="35%" r="75%">
            <stop offset="0" stopColor="#3a4b5c" />
            <stop offset=".55" stopColor="#1b2530" />
            <stop offset="1" stopColor="#0d1218" />
          </radialGradient>
        </defs>
        <g className="lens">
          <circle cx={X} cy={Y} r={R} fill="#1f1d1b" stroke="#0b0b0a" strokeWidth="16" />
          <circle cx={X} cy={Y} r={R - 40} fill="#FFC82E" />
          <circle cx={X} cy={Y} r={R - 62} fill="#0b0b0a" />
          <circle cx={X} cy={Y} r={R - 76} fill="url(#glass)" />
          <g className="iris-blades" opacity=".35">
            {Array.from({ length: 8 }).map((_, i) => (
              <path key={i} d={`M${X} ${Y} L${X + (R - 76)} ${Y - 40} A${R - 76} ${R - 76} 0 0 1 ${X + (R - 76) * 0.93} ${Y + 90} Z`} fill="none" stroke="#9FB3C8" strokeWidth="2" transform={`rotate(${i * 45} ${X} ${Y})`} />
            ))}
          </g>
          <circle cx={X - 110} cy={Y - 120} r="26" fill="#F2F2EF" opacity=".85" />
        </g>
        <circle className="disc" cx={X} cy={Y} r={R - 62} fill="#FFC82E" />
      </svg>

      {PRINCIPLES.map((p) => (
        <p key={p.id} className={cx('display absolute text-center text-[64px] text-paper opacity-0', `word-${p.id}`)} style={{ left: X - 240, width: 480, top: Y - 40 }}>
          {p.word}
        </p>
      ))}
      <p className="disc-text display absolute text-center text-[40px] leading-tight text-ink opacity-0" style={{ left: X - 220, width: 440, top: Y - 50 }}>
        L’IA propose.
        <br />
        Le cinéaste décide.
      </p>

      {PRINCIPLES.map((p) => (
        <div key={p.id} className={cx('absolute top-[250px] left-[1340px] w-[500px] opacity-0', `eng-${p.id}`)}>
          <p className="eyebrow text-[20px] text-gold">Déjà dans le code</p>
          <ul className="mt-4 grid list-none gap-5 p-0">
            {p.items.map((t) => (
              <li key={t} className="border-l-[6px] border-gold pl-5 text-[27px] leading-snug text-paper">
                {t}
              </li>
            ))}
          </ul>
        </div>
      ))}
      <div className="limits absolute top-[250px] left-[1340px] w-[500px] opacity-0">
        <p className="eyebrow text-[20px] text-brand-red">Ce que nous ne promettons pas encore</p>
        <ul className="mt-4 grid list-none gap-5 p-0">
          {LIMITS.map((t) => (
            <li key={t} className="border-l-[6px] border-brand-red pl-5 text-[25px] leading-snug text-paper">
              {t}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
