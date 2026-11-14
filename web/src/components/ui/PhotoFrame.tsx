import { useState } from 'react';
import { cn } from '@/lib/cn';

/**
 * Cadre photo 16:10 ou 2,39:1 avec crédit. Sans `src` (ou si l'image manque),
 * affiche un cadre sombre « [photo] » : on n'invente jamais d'image.
 */
export function PhotoFrame({
  src,
  alt,
  credit,
  ratio = '16:10',
  className,
  tilt,
}: {
  src?: string;
  alt: string;
  credit?: string;
  ratio?: '16:10' | '2.39:1';
  className?: string;
  tilt?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const show = src && !failed;
  return (
    <figure className={cn('relative', tilt && 'md:-rotate-2', className)}>
      <div
        className={cn(
          'relative overflow-hidden border-2 border-ink bg-surface-dark',
          ratio === '16:10' ? 'aspect-[16/10]' : 'aspect-[2.39/1]',
        )}
      >
        {show ? (
          <img src={src} alt={alt} onError={() => setFailed(true)} className="size-full object-cover" loading="lazy" />
        ) : (
          <div role="img" aria-label={alt} className="grid size-full place-items-center">
            <span className="eyebrow text-muted-on-dark">[photo]</span>
          </div>
        )}
        {/* repères de cadrage */}
        <span aria-hidden className="absolute top-2 left-2 size-4 border-t-2 border-l-2 border-gold" />
        <span aria-hidden className="absolute right-2 bottom-2 size-4 border-r-2 border-b-2 border-gold" />
      </div>
      {credit ? <figcaption className="eyebrow mt-2 text-muted-on-light">Photo : {credit}</figcaption> : null}
    </figure>
  );
}
