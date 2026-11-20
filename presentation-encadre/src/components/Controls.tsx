import { useEffect, useState } from 'react';
import { DECK } from '@/data/deck';
import { cx } from './ui';

/**
 * Barre de contrôle discrète (hors de la scène mise à l'échelle : toujours lisible).
 * Elle se cache après 2,5 s sans mouvement de souris et réapparaît au survol.
 */
export function Controls({
  scene,
  beat,
  onPrev,
  onNext,
  onGoto,
  reduced,
  onToggleMotion,
  auto,
  onToggleAuto,
  showNotes,
  onToggleNotes,
  onOpenPresenter,
  overview,
  onToggleOverview,
}: {
  scene: number;
  beat: number;
  onPrev: () => void;
  onNext: () => void;
  onGoto: (scene: number) => void;
  reduced: boolean;
  onToggleMotion: () => void;
  auto: boolean;
  onToggleAuto: () => void;
  showNotes: boolean;
  onToggleNotes: () => void;
  onOpenPresenter: () => void;
  overview: boolean;
  onToggleOverview: () => void;
}) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    let t = window.setTimeout(() => setVisible(false), 2500);
    const on = () => {
      setVisible(true);
      window.clearTimeout(t);
      t = window.setTimeout(() => setVisible(false), 2500);
    };
    window.addEventListener('mousemove', on);
    window.addEventListener('focusin', on);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('mousemove', on);
      window.removeEventListener('focusin', on);
    };
  }, []);

  const d = DECK[scene];
  const full = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.();
  };
  const btn = 'ctrl flex cursor-pointer items-center justify-center border-2 border-line-dark bg-ink/90 px-3 text-[14px] text-paper hover:border-gold hover:text-gold';

  return (
    <nav
      aria-label="Contrôles de la présentation"
      className={cx('fixed right-3 bottom-3 left-3 z-50 flex items-center gap-2 transition-opacity duration-300', visible || overview ? 'opacity-100' : 'pointer-events-none opacity-0')}
    >
      <button type="button" className={btn} onClick={onPrev} aria-label="Précédent (flèche gauche)">
        ←
      </button>
      <button type="button" className={cx(btn, 'border-gold text-gold')} onClick={onNext} aria-label="Suivant (flèche droite ou espace)">
        Suivant →
      </button>

      {/* Progression : un photogramme par séquence */}
      <ol className="mx-2 flex flex-1 list-none items-center gap-1 p-0" aria-label="Progression">
        {DECK.map((s, i) => (
          <li key={s.id} className="flex-1">
            <button
              type="button"
              onClick={() => onGoto(i)}
              aria-current={i === scene ? 'step' : undefined}
              aria-label={`${s.num} · ${s.title}`}
              title={`${s.num} · ${s.title}`}
              className={cx('block h-3 w-full cursor-pointer border-0 p-0', i < scene ? 'bg-gold' : i === scene ? 'bg-brand-red' : 'bg-line-dark')}
              style={i === scene ? { background: `linear-gradient(90deg, var(--color-brand-red) ${((beat + 1) / s.beats) * 100}%, #3a3733 0)` } : undefined}
            />
          </li>
        ))}
      </ol>

      <span className="eyebrow hidden px-2 text-[12px] whitespace-nowrap text-muted-on-dark md:inline">
        {d.num} · {d.title} · {beat + 1}/{d.beats}
      </span>
      <button type="button" className={cx(btn, overview && 'border-gold text-gold')} onClick={onToggleOverview} aria-pressed={overview} title="Plan (P)">
        Plan
      </button>
      <button type="button" className={cx(btn, showNotes && 'border-gold text-gold')} onClick={onToggleNotes} aria-pressed={showNotes} title="Notes (N)">
        Notes
      </button>
      <button type="button" className={btn} onClick={onOpenPresenter} title="Fenêtre présentateur (W)">
        Présentateur
      </button>
      <button type="button" className={cx(btn, auto && 'border-gold text-gold')} onClick={onToggleAuto} aria-pressed={auto} title="Lecture automatique (A)">
        Auto
      </button>
      <button type="button" className={cx(btn, reduced && 'border-gold text-gold')} onClick={onToggleMotion} aria-pressed={reduced} title="Animations réduites (M)">
        {reduced ? 'Mouvement réduit' : 'Animations'}
      </button>
      <button type="button" className={btn} onClick={full} title="Plein écran (F)">
        ⛶
      </button>
    </nav>
  );
}

/** Plan de la présentation : accès direct à chaque séquence. */
export function Overview({ scene, onGoto, onClose }: { scene: number; onGoto: (i: number) => void; onClose: () => void }) {
  return (
    <div role="dialog" aria-modal="true" aria-label="Plan de la présentation" className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-8" onClick={onClose}>
      <div className="w-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
        <p className="eyebrow mb-4 text-[14px] text-gold">Encadré · Prise 02 · Plan de tournage</p>
        <ol className="grid list-none grid-cols-2 gap-3 p-0 md:grid-cols-3">
          {DECK.map((s, i) => (
            <li key={s.id}>
              <button
                type="button"
                autoFocus={i === scene}
                onClick={() => onGoto(i)}
                className={cx('ctrl w-full cursor-pointer border-2 p-4 text-left', i === scene ? 'border-gold bg-gold text-ink' : 'border-line-dark bg-ink text-paper hover:border-gold')}
              >
                <span className="eyebrow block text-[12px] opacity-80">
                  {s.num} · {s.place} · ~{s.seconds} s
                </span>
                <span className="display mt-1 block text-[20px]">{s.title}</span>
                <span className="mt-1 block text-[13px] opacity-75">{s.question}</span>
              </button>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-[13px] text-muted-on-dark">
          Clavier : → / Espace suivant · ← précédent · 0–6 séquence · P plan · N notes · W présentateur · F plein écran · M animations · A auto · Échap fermer
        </p>
      </div>
    </div>
  );
}

/** Notes orales (panneau latéral, pour répéter ; en projection, préférer la fenêtre présentateur). */
export function NotesPanel({ scene, beat }: { scene: number; beat: number }) {
  const d = DECK[scene];
  return (
    <aside aria-label="Notes orales" className="fixed top-3 right-3 z-50 w-[min(440px,40vw)] border-2 border-gold bg-ink/95 p-5 text-paper">
      <p className="eyebrow text-[12px] text-gold">
        {d.num} · {d.title} · étape {beat + 1}/{d.beats} · ~{d.seconds} s
      </p>
      <p className="mt-1 text-[13px] text-muted-on-dark">{d.question}</p>
      <p className="mt-3 text-[16px] leading-relaxed">{d.notes[beat] ?? d.notes[d.notes.length - 1]}</p>
    </aside>
  );
}
