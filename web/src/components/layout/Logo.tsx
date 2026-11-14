import { Link } from 'react-router';
import { cn } from '@/lib/cn';

export function Logo({
  to = '/',
  onDark = true,
  className,
}: {
  to?: string;
  onDark?: boolean;
  className?: string;
}) {
  return (
    <Link
      to={to}
      className={cn('inline-flex min-h-11 items-center gap-2.5', className)}
      aria-label="Premier Plan, accueil"
    >
      <span
        aria-hidden
        className="grid size-8 place-items-center bg-brand-red font-display text-[18px] font-bold text-white"
      >
        P
      </span>
      <span
        className={cn(
          'font-display text-[20px] font-bold tracking-tight whitespace-nowrap',
          onDark ? 'text-paper' : 'text-ink',
        )}
      >
        Premier Plan
      </span>
    </Link>
  );
}
