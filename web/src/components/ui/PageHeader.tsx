import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Eyebrow } from './Eyebrow';

export function PageHeader({
  eyebrow,
  title,
  lead,
  actions,
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  lead?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn('flex flex-col gap-4 border-b-2 border-ink pb-6 md:flex-row md:items-end md:justify-between', className)}>
      <div className="max-w-3xl">
        {eyebrow ? <Eyebrow className="mb-3 text-muted-on-light">{eyebrow}</Eyebrow> : null}
        <h1 className="text-[40px] leading-none md:text-page">{title}</h1>
        {lead ? <p className="mt-4 text-lead text-muted-on-light">{lead}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-3 no-print">{actions}</div> : null}
    </header>
  );
}
