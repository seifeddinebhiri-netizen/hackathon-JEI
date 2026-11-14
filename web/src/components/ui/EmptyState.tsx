import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Icon, type IconName } from './Icon';

export function EmptyState({
  icon = 'film',
  title,
  children,
  action,
  className,
}: {
  icon?: IconName;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-start gap-4 border-2 border-dashed border-ink/40 bg-white p-6 md:p-10',
        className,
      )}
    >
      <span className="grid size-12 place-items-center bg-gold text-ink">
        <Icon name={icon} size={24} />
      </span>
      <div>
        <h2 className="text-h3">{title}</h2>
        {children ? <div className="mt-2 max-w-prose text-muted-on-light">{children}</div> : null}
      </div>
      {action}
    </div>
  );
}
