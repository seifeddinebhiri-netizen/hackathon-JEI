import { cn } from '@/lib/cn';
import { Icon } from './Icon';

export type Step = { id: string; label: string; done?: boolean };

/** Étapes d'un assistant. Cliquable si onSelect est fourni (retour à une étape). */
export function Stepper({
  steps,
  current,
  onSelect,
  className,
}: {
  steps: Step[];
  current: number;
  onSelect?: (index: number) => void;
  className?: string;
}) {
  return (
    <nav aria-label="Étapes" className={cn('no-print', className)}>
      <ol className="flex w-full overflow-x-auto border-2 border-ink">
        {steps.map((s, i) => {
          const active = i === current;
          const state = active ? 'Étape en cours' : s.done ? 'Étape terminée' : 'Étape à venir';
          const inner = (
            <>
              <span
                className={cn(
                  'grid size-7 shrink-0 place-items-center border-2 font-mono text-label',
                  active
                    ? 'border-ink bg-gold text-ink'
                    : s.done
                      ? 'border-paper bg-ink text-paper'
                      : 'border-ink',
                )}
              >
                {s.done && !active ? <Icon name="check" size={14} /> : i + 1}
              </span>
              <span className="text-left text-meta font-semibold">{s.label}</span>
              <span className="sr-only"> ({state})</span>
            </>
          );
          const cls = cn(
            'flex min-h-14 w-full min-w-36 items-center gap-2 px-3 py-2',
            active ? 'bg-ink text-paper' : 'bg-white text-ink',
            i > 0 && 'border-l-2 border-ink',
          );
          return (
            <li key={s.id} className="flex-1" aria-current={active ? 'step' : undefined}>
              {onSelect ? (
                <button
                  type="button"
                  className={cn(cls, !active && 'hover:bg-gold-soft')}
                  onClick={() => onSelect(i)}
                >
                  {inner}
                </button>
              ) : (
                <div className={cls}>{inner}</div>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
