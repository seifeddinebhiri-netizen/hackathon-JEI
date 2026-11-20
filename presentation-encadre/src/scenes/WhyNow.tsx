import { useRef } from 'react';
import type { SceneProps } from '@/data/deck';
import { useBeatTimeline } from '@/hooks/useBeatTimeline';
import { Corners, cx, Eyebrow } from '@/components/ui';

/**
 * PROBLÉMATIQUE 2/2 — « Pourquoi maintenant ».
 * Chiffres et règles VÉRIFIÉS (sources affichées sur la diapositive) :
 *  - JCC 2025 : 700 films inscrits (La Presse de Tunisie, 5 déc. 2025) ; compétitions officielles :
 *    14 longs de fiction + 12 longs documentaires + 16 courts = 42 films (listes du CNCI).
 *  - Oscars 2027 : règles de la 99e cérémonie (1er mai 2026) : scénarios écrits par des humains.
 *  - AI Act, art. 50 (Règlement UE 2024/1689) : obligations de transparence applicables depuis le 2 août 2026.
 * Chaque carte se relie à l'étape d'Encadré qu'elle concerne.
 */
const AXES = ['Planifier', 'Tourner', 'Déclarer', 'Diffuser'];
const AX = { x: 120, w: 360, gap: 30, y: 830, h: 120 };
const axX = (i: number) => AX.x + i * (AX.w + AX.gap);
const CARD = { y: 285, h: 445, w: 540, xs: [120, 690, 1260] };

/** Lien carte → axe (coude simple, dessiné en animant stroke-dashoffset) */
function link(card: number, axis: number) {
  const x1 = CARD.xs[card] + CARD.w / 2;
  const y1 = CARD.y + CARD.h;
  const x2 = axX(axis) + AX.w / 2;
  const y2 = AX.y;
  const my = (y1 + y2) / 2;
  return `M${x1},${y1} L${x1},${my} L${x2},${my} L${x2},${y2}`;
}
const LINKS: { card: number; axis: number; red?: boolean }[] = [
  { card: 0, axis: 0 },
  { card: 0, axis: 1 },
  { card: 2, axis: 3 },
  { card: 1, axis: 2, red: true },
];

function Icon({ kind }: { kind: 'phone' | 'clap' | 'law' }) {
  const p = { fill: 'none', strokeWidth: 3, strokeLinecap: 'square' as const };
  return (
    <svg viewBox="0 0 48 48" width="52" height="52" aria-hidden className={kind === 'law' ? 'text-brand-red' : 'text-gold'}>
      {kind === 'phone' ? (
        <g {...p} stroke="currentColor">
          <rect x="14" y="5" width="20" height="38" />
          <path d="M21 37h6" />
        </g>
      ) : kind === 'clap' ? (
        <g {...p} stroke="currentColor">
          <rect x="6" y="18" width="36" height="24" />
          <path d="M6 18l4-10 32 0-4 10M16 8l-4 10M26 8l-4 10M36 8l-4 10" />
        </g>
      ) : (
        <g {...p} stroke="currentColor">
          <path d="M24 6v34M12 42h24M8 12h32M8 12l-5 12h10zM40 12l-5 12h10z" />
        </g>
      )}
    </svg>
  );
}

export function WhyNow({ beat }: SceneProps) {
  const ref = useRef<HTMLElement>(null);

  useBeatTimeline(ref, beat, (tl) => {
    const counter = { v: 0 };
    const out = () => ref.current?.querySelector<HTMLElement>('.n700');
    tl.from('.head > *', { opacity: 0, y: -20, duration: 0.6, stagger: 0.12 }, 0)
      .from('.title span', { yPercent: 110, duration: 0.8, stagger: 0.1, ease: 'power4.out' }, 0.2)
      .from('.axis', { y: 40, opacity: 0, duration: 0.5, stagger: 0.08 }, 0.6)
      .addLabel('b0')
      // 1 · Tout le monde peut filmer → Planifier, Tourner
      .fromTo('.card-0', { opacity: 0, y: 50 }, { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out' }, 'b0')
      .fromTo('.lk-0, .lk-1', { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.6, stagger: 0.1 }, 'b0+=0.5')
      .to('.axis-0, .axis-1', { borderColor: '#FFC82E', color: '#FFC82E', duration: 0.3, stagger: 0.1 }, 'b0+=0.9')
      .addLabel('b1')
      // 2 · Les règles changent → Déclarer (en rouge)
      .fromTo('.card-2', { opacity: 0, y: 50 }, { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out' }, 'b1')
      .from('.card-2 .rule', { opacity: 0, x: -20, duration: 0.4, stagger: 0.25 }, 'b1+=0.4')
      .fromTo('.lk-3', { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.6 }, 'b1+=0.9')
      .to('.axis-2', { backgroundColor: '#E4202E', borderColor: '#E4202E', color: '#FFFFFF', duration: 0.35 }, 'b1+=1.4')
      .addLabel('b2')
      // 3 · Tout le monde veut être vu → Diffuser (compteur 0 → 700)
      .fromTo('.card-1', { opacity: 0, y: 50 }, { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out' }, 'b2')
      .fromTo(
        counter,
        { v: 0 },
        {
          v: 700,
          duration: 1.2,
          ease: 'power2.out',
          onUpdate: () => {
            const el = out();
            if (el) el.textContent = String(Math.round(counter.v));
          },
        },
        'b2+=0.4',
      )
      .from('.n42', { opacity: 0, scale: 0.6, transformOrigin: '0% 80%', duration: 0.4, ease: 'back.out(2)' }, 'b2+=1.4')
      .fromTo('.lk-2', { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.6 }, 'b2+=1.2')
      .to('.axis-3', { borderColor: '#FFC82E', color: '#FFC82E', duration: 0.3 }, 'b2+=1.7')
      .addLabel('b3');
  });

  return (
    <section ref={ref} className="grain absolute inset-0 overflow-hidden bg-ink" aria-label="Problématique : pourquoi maintenant">
      <Corners inset={40} size={60} stroke={5} color="#3a3733" />
      <div className="head absolute top-[64px] left-[100px]">
        <Eyebrow color="text-gold">Problématique · Pourquoi maintenant</Eyebrow>
        <h2 className="title display mt-3 text-[70px] text-paper">
          <span className="inline-block overflow-hidden align-bottom">
            <span className="inline-block">Personne ne leur a appris</span>
          </span>{' '}
          <span className="inline-block overflow-hidden align-bottom">
            <span className="inline-block text-gold">comment.</span>
          </span>
        </h2>
      </div>

      {/* Liens cartes → étapes */}
      <svg aria-hidden viewBox="0 0 1920 1080" className="pointer-events-none absolute inset-0 h-full w-full">
        {LINKS.map((l, i) => (
          <path key={i} className={`lk-${i}`} d={link(l.card, l.axis)} fill="none" stroke={l.red ? '#E4202E' : '#FFC82E'} strokeOpacity=".8" strokeWidth="4" pathLength={1} strokeDasharray="1" strokeDashoffset={0} />
        ))}
      </svg>

      {/* 1 · Filmer */}
      <div className="card-0 absolute flex flex-col border-[3px] border-paper bg-[#181715] p-8 opacity-0" style={{ left: CARD.xs[0], top: CARD.y, width: CARD.w, height: CARD.h, boxShadow: '10px 10px 0 #000' }}>
        <Icon kind="phone" />
        <p className="display mt-5 text-[44px] leading-[1.02] text-paper">Tout le monde peut filmer</p>
        <p className="mt-5 text-[25px] leading-snug text-muted-on-dark">Un téléphone suffit pour tourner un film. Mais personne n’apprend à organiser un tournage, ni à cadrer.</p>
      </div>

      {/* 2 · Être vu */}
      <div className="card-1 absolute flex flex-col border-[3px] border-paper bg-[#181715] p-8 opacity-0" style={{ left: CARD.xs[2], top: CARD.y, width: CARD.w, height: CARD.h, boxShadow: '10px 10px 0 #000' }}>
        <Icon kind="clap" />
        <p className="display mt-5 text-[44px] leading-[1.02] text-paper">Tout le monde veut être vu</p>
        <div className="mt-5 flex items-end gap-10">
          <div>
            <p className="n700 display text-[96px] leading-none text-gold">700</p>
            <p className="mt-1 text-[21px] text-muted-on-dark">films inscrits</p>
          </div>
          <div className="n42">
            <p className="display text-[96px] leading-none text-paper">42</p>
            <p className="mt-1 text-[21px] text-muted-on-dark">en compétition officielle</p>
          </div>
        </div>
        <p className="mt-auto text-[16px] leading-snug text-muted-on-dark">JCC 2025. Sources : La Presse de Tunisie, 5 déc. 2025 ; listes officielles du CNCI (14 fictions, 12 documentaires, 16 courts).</p>
      </div>

      {/* 3 · La règle */}
      <div className="card-2 absolute flex flex-col border-[3px] border-brand-red bg-[#181715] p-8 opacity-0" style={{ left: CARD.xs[1], top: CARD.y, width: CARD.w, height: CARD.h, boxShadow: '10px 10px 0 #E4202E' }}>
        <Icon kind="law" />
        <p className="display mt-5 text-[44px] leading-[1.02] text-paper">Les règles changent</p>
        <p className="rule mt-5 text-[24px] leading-snug text-paper">
          <b className="text-gold">Oscars 2027 :</b> scénarios écrits par des humains.
        </p>
        <p className="rule mt-3 text-[24px] leading-snug text-paper">
          <b className="text-gold">AI Act, art. 50 :</b> depuis le 2 août 2026, signaler les contenus truqués par IA (UE).
        </p>
        <p className="mt-auto text-[16px] leading-snug text-muted-on-dark">Sources : règles de la 99e cérémonie des Oscars (1er mai 2026) ; Règlement (UE) 2024/1689, art. 50.</p>
      </div>

      {/* Les quatre étapes d'Encadré */}
      {AXES.map((a, i) => (
        <div
          key={a}
          className={cx('axis display absolute flex items-center justify-center border-[3px] border-line-dark text-[44px] text-muted-on-dark', `axis-${i}`)}
          style={{ left: axX(i), top: AX.y, width: AX.w, height: AX.h, boxShadow: '8px 8px 0 #000' }}
        >
          {a}
        </div>
      ))}
    </section>
  );
}
