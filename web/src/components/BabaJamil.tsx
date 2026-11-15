import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Baba Jamil, la mascotte d'encadré : une vieille caméra devenue un oncle bienveillant qui « encadre »
 * le jeune réalisateur. C'est une MASCOTTE, pas l'IA : elle ne présente jamais un contenu généré comme
 * le sien, ne cache jamais une étiquette « Brouillon IA » et ne remplace pas un texte d'aide.
 *
 * Les animations sont dans les SVG (CSS interne) et s'arrêtent seules avec prefers-reduced-motion.
 */
export type BabaJamilPose = 'salut' | 'parle' | 'montre' | 'planifier' | 'tourner' | 'declarer' | 'diffuser';

const SIZES = {
  // Sur mobile : taille « s » au maximum
  s: 'w-24',
  m: 'w-24 md:w-40',
  l: 'w-24 md:w-[260px]',
} as const;

export const MASCOT_ALT = 'Baba Jamil, la mascotte d’encadré';

export function BabaJamil({
  pose,
  bulle,
  cote = 'droite',
  taille = 'm',
  decoratif,
  aligne = 'centre',
  className,
}: {
  pose: BabaJamilPose;
  /** Texte court ; l'information utile doit aussi rester dans la page */
  bulle?: string;
  /** Côté de la bulle par rapport à la mascotte (sur mobile, la bulle passe au-dessus) */
  cote?: 'gauche' | 'droite';
  taille?: keyof typeof SIZES;
  /** Image purement décorative (ex. illustration répétée à côté d'un titre) */
  decoratif?: boolean;
  /** Alignement vertical de la bulle par rapport à la mascotte (grand écran) */
  aligne?: 'centre' | 'bas';
  className?: string;
}) {
  const img = (
    <img
      src={`/mascotte/baba-jamil-${pose}.svg`}
      alt={bulle || decoratif ? '' : MASCOT_ALT}
      width={320}
      height={290}
      loading="lazy"
      decoding="async"
      className={cn('h-auto shrink-0 select-none', SIZES[taille])}
      draggable={false}
    />
  );
  if (!bulle) return <div className={cn('inline-block', className)}>{img}</div>;

  return (
    <figure
      className={cn(
        'flex flex-col items-start gap-3',
        aligne === 'bas' ? 'md:items-end' : 'md:items-center',
        cote === 'droite' ? 'md:flex-row' : 'md:flex-row-reverse',
        className,
      )}
    >
      <figcaption
        className={cn(
          'relative order-first max-w-xs border-[3px] border-ink bg-paper px-4 py-3 text-[15px] leading-snug font-medium text-ink shadow-hard-red md:order-none md:text-body',
        )}
      >
        <span className="sr-only">Baba Jamil : </span>
        {bulle}
        {/* Pointe vers la mascotte : en bas sur mobile, sur le côté sur grand écran */}
        <Pointer cote={cote} />
      </figcaption>
      <span className="shrink-0 md:order-first">{img}</span>
    </figure>
  );
}

function Pointer({ cote }: { cote: 'gauche' | 'droite' }) {
  return (
    <>
      {/* mobile : pointe vers le bas, à gauche */}
      <span aria-hidden className="absolute -bottom-[14px] left-8 md:hidden">
        <span className="absolute block size-0 border-x-[11px] border-t-[13px] border-x-transparent border-t-ink" />
        <span className="absolute top-0 left-[4px] block size-0 border-x-[7px] border-t-[9px] border-x-transparent border-t-paper" />
      </span>
      {/* grand écran : pointe latérale vers la mascotte */}
      <span
        aria-hidden
        className={cn(
          'absolute top-1/2 hidden -translate-y-1/2 md:block',
          cote === 'droite' ? '-left-[14px]' : '-right-[14px]',
        )}
      >
        <span
          className={cn(
            'block size-0 border-y-[11px] border-y-transparent',
            cote === 'droite' ? 'border-r-[13px] border-r-ink' : 'border-l-[13px] border-l-ink',
          )}
        />
        <span
          className={cn(
            'absolute top-[4px] block size-0 border-y-[7px] border-y-transparent',
            cote === 'droite'
              ? 'left-[5px] border-r-[9px] border-r-paper'
              : 'right-[5px] border-l-[9px] border-l-paper',
          )}
        />
      </span>
    </>
  );
}

/**
 * Bulle seule (même style que celle de BabaJamil), pour une mise en scène libre.
 * `pointe` : côté de la bulle d'où part la pointe (« bas-droite » : sous la bulle, à droite).
 */
export function Bulle({
  children,
  pointe,
  className,
}: {
  children: ReactNode;
  pointe: 'gauche' | 'droite' | 'bas-droite';
  className?: string;
}) {
  return (
    <p
      className={cn(
        'relative w-max max-w-[220px] border-[3px] border-ink bg-paper px-3 py-2 text-[15px] leading-snug font-medium text-ink shadow-hard-red',
        className,
      )}
    >
      <span className="sr-only">Baba Jamil : </span>
      {children}
      {pointe === 'bas-droite' ? (
        <span aria-hidden className="absolute right-10 -bottom-[14px]">
          <span className="absolute block size-0 border-x-[11px] border-t-[13px] border-x-transparent border-t-ink" />
          <span className="absolute top-0 left-[4px] block size-0 border-x-[7px] border-t-[9px] border-x-transparent border-t-paper" />
        </span>
      ) : (
        <span
          aria-hidden
          className={cn(
            'absolute top-1/2 -translate-y-1/2',
            pointe === 'gauche' ? '-left-[14px]' : '-right-[14px]',
          )}
        >
          <span
            className={cn(
              'block size-0 border-y-[11px] border-y-transparent',
              pointe === 'gauche' ? 'border-r-[13px] border-r-ink' : 'border-l-[13px] border-l-ink',
            )}
          />
          <span
            className={cn(
              'absolute top-[4px] block size-0 border-y-[7px] border-y-transparent',
              pointe === 'gauche'
                ? 'left-[5px] border-r-[9px] border-r-paper'
                : 'right-[5px] border-l-[9px] border-l-paper',
            )}
          />
        </span>
      )}
    </p>
  );
}
