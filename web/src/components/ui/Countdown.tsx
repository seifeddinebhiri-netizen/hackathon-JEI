import { daysUntil, formatDate } from '@/lib/format';
import { cn } from '@/lib/cn';
import { Icon } from './Icon';

/** Compte à rebours en jours jusqu'à une date limite (texte + icône si proche). */
export function Countdown({ date, className }: { date: string; className?: string }) {
  const d = daysUntil(date);
  const urgent = d >= 0 && d <= 14;
  const past = d < 0;
  const label = past ? 'Date limite passée' : d === 0 ? "Aujourd'hui" : d === 1 ? 'Demain' : `J-${d}`;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 border-2 px-2 py-1 font-mono text-label font-medium uppercase',
        past
          ? 'border-line-light text-muted-on-light'
          : urgent
            ? 'border-bad-fg bg-bad-bg text-bad-fg'
            : 'border-ink',
        className,
      )}
      title={formatDate(date)}
    >
      {urgent ? <Icon name="clock" size={14} /> : null}
      {label}
      <span className="sr-only"> (date limite : {formatDate(date)})</span>
    </span>
  );
}
