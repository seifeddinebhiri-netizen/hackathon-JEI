import { useId, type ReactNode, type RefObject } from 'react';
import { Icon } from '@/components/ui';
import { cn } from '@/lib/cn';
import type { SrtLang } from '../../lib/srt';

/** Choix du fichier vidéo : lu par le navigateur, jamais envoyé. */
export function ChooseVideo({
  onFile,
  label,
  className,
}: {
  onFile: (file: File) => void;
  label: string;
  className?: string;
}) {
  const id = useId();
  return (
    <label
      htmlFor={id}
      className={cn(
        'inline-flex min-h-11 cursor-pointer items-center gap-2 font-semibold has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-gold',
        className,
      )}
    >
      <Icon name="upload" size={16} />
      {label}
      <input
        id={id}
        type="file"
        accept="video/*"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = '';
        }}
      />
    </label>
  );
}

/**
 * Cadre vidéo sombre (le reste de la page reste clair). Le sous-titre de la ligne est incrusté en
 * bas de l'image, avec ou sans vidéo : sans vidéo, on relit quand même chaque ligne à sa place.
 */
export function VideoFrame({
  url,
  videoRef,
  text,
  lang,
  timecode,
  badge,
  onPlay,
  onPause,
  onToggle,
  onChooseFile,
}: {
  url: string | null;
  videoRef: RefObject<HTMLVideoElement>;
  text: string;
  lang: SrtLang;
  timecode: string;
  badge?: ReactNode;
  onPlay: () => void;
  onPause: () => void;
  onToggle: () => void;
  onChooseFile: (file: File) => void;
}) {
  return (
    <div className="relative aspect-video w-full overflow-hidden bg-ink text-paper">
      {url ? (
        <video
          ref={videoRef}
          src={url}
          className="absolute inset-0 size-full bg-ink object-contain"
          playsInline
          onPlay={onPlay}
          onPause={onPause}
          onEnded={onPause}
          onClick={onToggle}
        />
      ) : (
        <div className="absolute inset-0 grid place-items-center" aria-hidden>
          <Icon name="film" size={40} className="text-line-dark" />
        </div>
      )}
      <div className="pointer-events-none absolute inset-x-3 top-3 flex flex-wrap items-start justify-between gap-2">
        <span className="eyebrow bg-ink/80 px-2 py-1 text-muted-on-dark">{timecode}</span>
        {badge}
      </div>
      {!url ? (
        <ChooseVideo
          onFile={onChooseFile}
          label="Choisir ma vidéo"
          className="absolute right-3 bottom-3 border border-line-dark bg-ink/80 px-3 text-meta text-paper hover:border-gold md:top-12 md:bottom-auto"
        />
      ) : null}
      {text ? (
        <p
          lang={lang}
          aria-live="off"
          data-testid="sous-titre-incruste"
          className={cn(
            'pointer-events-none absolute inset-x-3 mx-auto line-clamp-2 w-fit max-w-[92%] bg-ink/75 px-3 py-1 text-center text-[16px] leading-snug font-semibold text-white md:bottom-6 md:text-[22px]',
            url ? 'bottom-3' : 'bottom-16',
          )}
        >
          {text}
        </p>
      ) : null}
    </div>
  );
}
