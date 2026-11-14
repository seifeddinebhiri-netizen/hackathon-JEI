import { cn } from '@/lib/cn';

/** Bande de perforations de pellicule (décorative). */
export function Perforations({ className, tone = 'dark' }: { className?: string; tone?: 'dark' | 'light' | 'gold' }) {
  const bg = tone === 'dark' ? 'bg-ink' : tone === 'gold' ? 'bg-gold' : 'bg-paper';
  const hole = tone === 'dark' ? 'bg-paper/90' : 'bg-ink';
  return (
    <div aria-hidden className={cn('flex h-6 items-center gap-3 overflow-hidden px-3', bg, className)}>
      {Array.from({ length: 80 }, (_, i) => (
        <span key={i} className={cn('h-3 w-4 shrink-0', hole)} />
      ))}
    </div>
  );
}
