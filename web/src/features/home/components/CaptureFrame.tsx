import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Style UNIQUE des captures d'écran de l'accueil : cadre noir, barre de titre, ombre décalée.
 * Le contenu est du vrai HTML (pas d'image), décoratif pour les lecteurs d'écran.
 */
export function CaptureFrame({
  path,
  children,
  tilt = 'left',
  className,
}: {
  path: string;
  children: ReactNode;
  tilt?: 'left' | 'right' | 'none';
  className?: string;
}) {
  return (
    <div
      aria-hidden
      className={cn(
        'border-2 border-ink bg-white shadow-hard select-none',
        tilt === 'left' && 'md:-rotate-[1.5deg]',
        tilt === 'right' && 'md:rotate-[1.5deg]',
        className,
      )}
    >
      <div className="flex items-center gap-2 border-b-2 border-ink bg-ink px-3 py-2">
        <span className="size-2.5 bg-brand-red" />
        <span className="size-2.5 bg-gold" />
        <span className="size-2.5 bg-paper" />
        <span className="ml-2 min-w-0 truncate font-mono text-label text-muted-on-dark">premierplan / {path}</span>
      </div>
      <div className="p-4 md:p-5">{children}</div>
    </div>
  );
}
