import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Feuille imprimable (A4) à l'intérieur de l'App : barre d'actions masquée à l'impression,
 * contenu noir sur blanc. Les styles @media print sont dans styles/index.css.
 */
export function PrintLayout({
  actions,
  children,
  className,
}: {
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className="mx-auto max-w-[210mm]">
      {actions ? <div className="no-print mb-6 flex flex-wrap gap-3">{actions}</div> : null}
      <article
        className={cn(
          'border-2 border-ink bg-white p-6 text-ink md:p-10 print:border-0 print:p-0',
          className,
        )}
      >
        {children}
      </article>
    </div>
  );
}
