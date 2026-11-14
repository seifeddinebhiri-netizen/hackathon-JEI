import { cn } from '@/lib/cn';
import { Icon } from './Icon';

/** Marque toute proposition de l'IA : elle reste un brouillon modifiable. */
export function AiDraftBadge({ validated = false, className }: { validated?: boolean; className?: string }) {
  if (validated) {
    return (
      <span className={cn('eyebrow inline-flex items-center gap-1.5 border border-ok-fg/30 bg-ok-bg px-2 py-1 text-ok-fg', className)}>
        <Icon name="check" size={14} />
        Validé par toi
      </span>
    );
  }
  return (
    <span
      className={cn(
        'eyebrow inline-flex items-center gap-1.5 border border-dashed border-ink bg-gold-soft px-2 py-1 text-ink',
        className,
      )}
    >
      <Icon name="sparkle" size={14} />
      Brouillon IA : à valider
    </span>
  );
}
