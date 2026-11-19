import { cn } from '@/lib/cn';
import { Icon } from './Icon';

export type Step = { id: string; label: string; done?: boolean };

/** Étapes d'un assistant. Cliquable si onSelect est fourni (retour à une étape). */
export function Stepper({
  steps,
  current,
  onSelect,
  compact,
  className,
}: {
  steps: Step[];
  current: number;
  onSelect?: (index: number) => void;
  /** Version basse : sur mobile, seul le nom de l'étape en cours est affiché. */
  compact?: boolean;
  className?: string;
}) {
  return (
    <nav aria-label="Étapes de l’assistant" className={cn('no-print', className)}>
      <ol className="flex w-full overflow-x-auto border-2 border-ink">
        {steps.map((s, i) => {
          const active = i === current;
          const state = active ? 'Étape en cours' : s.done ? 'Étape terminée' : 'Étape à venir';
          const inner = (
            <>
              <span
                className={cn(
                  'grid shrink-0 place-items-center border-2 font-mono text-label',
                  compact ? 'size-6' : 'size-7',
                  active
                    ? 'border-ink bg-gold text-ink'
                    : s.done
                      ? 'border-paper bg-ink text-paper'
                      : 'border-ink',
                )}
              >
                {s.done && !active ? <Icon name="check" size={14} /> : i + 1}
              </span>
              <span
                className={cn(
                  'text-left text-meta font-semibold',
                  compact && !active && 'sr-only sm:not-sr-only',
                )}
              >
                {s.label}
              </span>
              <span className="sr-only"> ({state})</span>
            </>
          );
          const cls = cn(
            'flex w-full items-center gap-2',
            compact
              ? 'min-h-11 min-w-11 justify-center px-2 py-1 sm:justify-start'
              : 'min-h-14 min-w-36 px-3 py-2',
            active ? 'bg-ink text-paper' : 'bg-white text-ink',
            i > 0 && 'border-l-2 border-ink',
          );
          return (
            <li
              key={s.id}
              className={compact && !active ? 'flex-none sm:flex-1' : 'flex-1'}
              aria-current={active ? 'step' : undefined}
            >
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
