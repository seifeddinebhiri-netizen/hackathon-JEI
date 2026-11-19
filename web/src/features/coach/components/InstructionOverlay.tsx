import { cn } from '@/lib/cn';
import type { Instruction } from '../checks';

const TEXT_SHADOW = '[text-shadow:0_1px_8px_rgb(18_17_16/0.9)]';

/**
 * La consigne, au centre de l'image : maquette grise et fine, texte dont seul le nombre change.
 * Sans fond ni carte pour ne pas masquer la scène. Elle apparaît en fondu ; `leaving` la fait
 * s'effacer.
 */
export function InstructionOverlay({
  instruction,
  leaving,
  showWhy,
}: {
  instruction: Instruction | null;
  leaving: boolean;
  showWhy: boolean;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none absolute inset-0 grid place-items-center p-4"
    >
      {instruction ? (
        <div
          key={`${instruction.check.id}:${instruction.variantKey}`}
          className={cn(
            'coach-fade-in flex max-w-[80vw] flex-col items-center gap-2 text-center text-paper transition-opacity duration-300 motion-reduce:transition-none',
            leaving && 'opacity-0',
          )}
        >
          <img
            src={instruction.variant.image}
            alt=""
            width={320}
            height={200}
            className="w-44 opacity-90 [filter:drop-shadow(0_0_3px_rgb(18_17_16/0.8))] sm:w-56 landscape:w-36"
          />
          <p className={cn('font-display text-h3 leading-tight font-medium', TEXT_SHADOW)}>
            {instruction.title}
          </p>
          <p className={cn('text-meta text-paper/85', TEXT_SHADOW)}>{instruction.variant.hint}</p>
          {showWhy ? (
            <p className={cn('max-w-xs border-t border-paper/40 pt-2 text-meta', TEXT_SHADOW)}>
              {instruction.variant.why}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
