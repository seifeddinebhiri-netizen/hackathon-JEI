import { cn } from '@/lib/cn';

const LABELS = ['', 'Peu compatible', 'À vérifier', 'Compatible', 'Très compatible', 'Excellent accord'] as const;

/** Score 1-5 : carrés pleins + libellé texte (jamais la forme seule). */
export function ScoreSquares({ score, className }: { score: 1 | 2 | 3 | 4 | 5; className?: string }) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="flex gap-1" aria-hidden>
        {[1, 2, 3, 4, 5].map((n) => (
          <span key={n} className={cn('size-3.5 border-2 border-ink', n <= score ? 'bg-ink' : 'bg-transparent')} />
        ))}
      </div>
      <span className="eyebrow">
        {score}/5 · {LABELS[score]}
      </span>
    </div>
  );
}
