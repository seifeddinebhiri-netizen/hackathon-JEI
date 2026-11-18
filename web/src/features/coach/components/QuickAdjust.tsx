import { ADJUST_FIELDS, type Adjust } from '../imageFilter';
import { cn } from '@/lib/cn';

const QUICK = ADJUST_FIELDS.filter((f) => f.key === 'contrast' || f.key === 'temperature');
const SHADOW = '[text-shadow:0_1px_6px_rgb(18_17_16/0.95)]';

/**
 * Tiroir qui glisse depuis le bord droit : contraste et chaleur de l'image, sans ouvrir « Réglages ».
 * Toucher une poignée l'ouvre ou le ferme. Bouger un curseur active la retouche de l'image.
 */
export function QuickAdjust({
  open,
  onOpenChange,
  adjust,
  onChange,
  onReset,
  locked,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  adjust: Adjust;
  onChange: (key: keyof Adjust, value: number) => void;
  onReset: () => void;
  /** Prise en cours sans retouche : on ne peut pas la lancer au milieu d'un enregistrement. */
  locked: boolean;
}) {
  return (
    <div
      className={cn(
        'absolute top-1/2 right-0 z-10 flex -translate-y-1/2 items-stretch transition-transform duration-200 motion-reduce:transition-none',
        open ? 'translate-x-0' : 'translate-x-[calc(100%-2.75rem)]',
      )}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls="reglages-rapides"
        onClick={() => onOpenChange(!open)}
        className={cn(
          'flex h-32 w-11 items-center justify-center border-y-2 border-l-2 border-paper/70 bg-ink/50 text-paper',
          SHADOW,
        )}
      >
        <span className="text-label [writing-mode:vertical-rl]">Contraste · Chaleur</span>
      </button>
      <section
        id="reglages-rapides"
        aria-label="Contraste et chaleur"
        aria-hidden={!open}
        className={cn(
          'flex w-[min(72vw,17rem)] flex-col gap-1 border-y-2 border-l border-paper/70 bg-ink/30 p-3 text-paper',
          SHADOW,
        )}
      >
        {QUICK.map((f) => (
          <label key={f.key} className="flex flex-col text-meta">
            <span className="flex justify-between">
              {f.label}
              <span className="font-mono text-label">{Number(adjust[f.key].toFixed(2))}</span>
            </span>
            <input
              type="range"
              min={f.min}
              max={f.max}
              step={f.step}
              value={adjust[f.key]}
              disabled={locked || !open}
              tabIndex={open ? 0 : -1}
              onChange={(e) => onChange(f.key, Number(e.target.value))}
              className="h-11 w-full accent-gold"
            />
          </label>
        ))}
        {locked ? (
          <p className="text-label text-gold">
            Active la retouche avant de filmer : elle ne peut pas démarrer pendant une prise.
          </p>
        ) : null}
        <button
          type="button"
          disabled={!open}
          tabIndex={open ? 0 : -1}
          onClick={onReset}
          className="min-h-11 self-start text-meta underline underline-offset-2"
        >
          Remettre à zéro
        </button>
      </section>
    </div>
  );
}
