import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Icon } from './Icon';

/**
 * Explication longue repliée : « En savoir plus ». Marche au clavier et au toucher
 * (contrairement à une info-bulle, qui ne s'ouvre pas sur mobile).
 */
export function MoreInfo({
  children,
  label = 'En savoir plus',
  className,
}: {
  children: ReactNode;
  label?: string;
  className?: string;
}) {
  return (
    <details className={cn('group text-meta', className)}>
      <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1.5 font-semibold underline-offset-4 hover:underline [&::-webkit-details-marker]:hidden">
        <Icon name="info" size={16} aria-hidden />
        {label}
        <Icon
          name="chevronDown"
          size={16}
          aria-hidden
          className="transition-transform group-open:rotate-180"
        />
      </summary>
      <div className="max-w-prose pb-2 text-muted-on-light">{children}</div>
    </details>
  );
}
