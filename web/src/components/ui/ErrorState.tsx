import { cn } from '@/lib/cn';
import { Button } from './Button';
import { Icon } from './Icon';

export function ErrorState({
  title = 'Ça n’a pas marché',
  error,
  onRetry,
  retrying,
  className,
}: {
  title?: string;
  error?: unknown;
  onRetry?: () => void;
  retrying?: boolean;
  className?: string;
}) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : 'Une erreur inattendue s’est produite.';
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-start gap-4 border-2 border-bad-fg bg-bad-bg p-6 text-bad-fg',
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <Icon name="alert" size={24} className="mt-0.5 shrink-0" />
        <div>
          <h2 className="text-h3">{title}</h2>
          <p className="mt-1">{message}</p>
        </div>
      </div>
      {onRetry ? (
        <Button variant="secondary" icon="arrowRight" onClick={onRetry} loading={retrying}>
          Réessayer
        </Button>
      ) : null}
    </div>
  );
}
