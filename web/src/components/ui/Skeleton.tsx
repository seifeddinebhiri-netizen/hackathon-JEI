import { cn } from '@/lib/cn';

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('animate-pulse-soft bg-line-light', className)} />;
}

/** Bloc de chargement accessible : annonce « Chargement » aux lecteurs d'écran. */
export function LoadingBlock({
  label = 'Chargement…',
  lines = 3,
  className,
}: {
  label?: string;
  lines?: number;
  className?: string;
}) {
  return (
    <div role="status" aria-live="polite" className={cn('flex flex-col gap-3', className)}>
      <span className="sr-only">{label}</span>
      <Skeleton className="h-8 w-2/3" />
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={cn('h-4', i % 2 ? 'w-5/6' : 'w-full')} />
      ))}
    </div>
  );
}
