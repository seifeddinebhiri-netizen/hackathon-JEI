import { useState } from 'react';
import { cn } from '@/lib/cn';
import { PHOTOS, photoSources, type Photo, type PhotoKey } from '@/lib/photos';

export type PhotoRatio = '16:10' | '2.39:1' | '4:5' | '3:2';

const RATIOS: Record<PhotoRatio, string> = {
  '16:10': 'aspect-[16/10]',
  '2.39:1': 'aspect-[2.39/1]',
  '4:5': 'aspect-[4/5]',
  '3:2': 'aspect-[3/2]',
};

/**
 * Cadre photo avec crédit discret.
 * - `photo` : une photo du registre (lib/photos.ts) → WebP + JPEG de secours, crédit Unsplash automatique ;
 * - `src` : une image quelconque (ex. photo envoyée par l'utilisateur) ;
 * - rien (ou image introuvable) : cadre sombre « [photo] » — on n'invente jamais d'image.
 * Traitement « Noir pellicule » appliqué en CSS (.photo-grade), les fichiers restent intacts.
 */
export function PhotoFrame({
  photo,
  src,
  alt,
  credit,
  ratio = '16:10',
  sizes = '(min-width: 1024px) 50vw, 100vw',
  priority,
  onDark,
  tilt,
  className,
}: {
  photo?: PhotoKey | Photo;
  src?: string;
  alt?: string;
  credit?: string;
  ratio?: PhotoRatio;
  sizes?: string;
  /** Image au-dessus de la ligne de flottaison : chargement immédiat */
  priority?: boolean;
  onDark?: boolean;
  tilt?: boolean;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const p = typeof photo === 'string' ? PHOTOS[photo] : photo;
  const altText = alt ?? p?.alt ?? '';
  const show = (p || src) && !failed;
  const sources = p ? photoSources(p) : undefined;

  return (
    <figure className={cn('relative', tilt && 'md:-rotate-2', className)}>
      <div
        className={cn(
          'relative overflow-hidden border-2 bg-surface-dark',
          onDark ? 'border-line-dark' : 'border-ink',
          RATIOS[ratio],
        )}
      >
        {show ? (
          sources ? (
            <picture>
              <source type="image/webp" srcSet={sources.webpSet} sizes={sizes} />
              <img
                src={sources.jpg}
                srcSet={sources.jpgSet}
                sizes={sizes}
                alt={altText}
                onError={() => setFailed(true)}
                loading={priority ? 'eager' : 'lazy'}
                decoding="async"
                className="photo-grade absolute inset-0 size-full object-cover"
                style={{ objectPosition: p?.position }}
              />
            </picture>
          ) : (
            <img
              src={src}
              alt={altText}
              onError={() => setFailed(true)}
              loading={priority ? 'eager' : 'lazy'}
              decoding="async"
              className="photo-grade absolute inset-0 size-full object-cover"
            />
          )
        ) : (
          <div role="img" aria-label={altText} className="grid size-full place-items-center">
            <span className="eyebrow text-muted-on-dark">[photo]</span>
          </div>
        )}
        {/* repères de cadrage */}
        <span aria-hidden className="absolute top-2 left-2 size-4 border-t-2 border-l-2 border-gold" />
        <span aria-hidden className="absolute right-2 bottom-2 size-4 border-r-2 border-b-2 border-gold" />
        {p && show ? (
          <p className="absolute top-0 right-0 max-w-[85%] bg-ink/80 px-2 py-1 font-mono text-label text-paper">
            Photo : {p.author} / Unsplash
          </p>
        ) : null}
      </div>
      {credit && !p ? (
        <figcaption className={cn('eyebrow mt-2', onDark ? 'text-muted-on-dark' : 'text-muted-on-light')}>
          Photo : {credit}
        </figcaption>
      ) : null}
    </figure>
  );
}
