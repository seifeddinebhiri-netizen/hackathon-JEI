import { useId, useRef, useState, type DragEvent } from 'react';
import { cn } from '@/lib/cn';
import { Icon } from './Icon';

/** Zone de dépôt de fichier, utilisable au clavier (c'est un vrai bouton + input file). */
export function FileDrop({
  accept,
  maxSizeMb,
  onFile,
  file,
  disabled,
  label = 'Dépose ton fichier ici',
  hint,
  error,
}: {
  accept: string[];
  maxSizeMb?: number;
  onFile: (f: File | null) => void;
  file?: File | null;
  disabled?: boolean;
  label?: string;
  hint?: string;
  error?: string;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [localError, setLocalError] = useState<string>();

  const pick = (f: File | undefined) => {
    if (!f) return;
    const ext = `.${f.name.split('.').pop()?.toLowerCase()}`;
    if (!accept.includes(ext)) {
      setLocalError(`Format non pris en charge. Formats acceptés : ${accept.join(', ')}.`);
      return;
    }
    if (maxSizeMb && f.size > maxSizeMb * 1024 * 1024) {
      setLocalError(`Fichier trop lourd (${maxSizeMb} Mo maximum).`);
      return;
    }
    setLocalError(undefined);
    onFile(f);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    if (!disabled) pick(e.dataTransfer.files[0]);
  };

  const err = error ?? localError;
  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        className={cn(
          'flex flex-col items-center gap-3 border-2 border-dashed p-8 text-center transition-colors',
          over ? 'border-ink bg-gold-soft' : 'border-ink/50 bg-white',
          disabled && 'opacity-60',
          err && 'border-bad-fg',
        )}
      >
        <Icon name={file ? 'doc' : 'upload'} size={32} />
        {file ? (
          <p className="font-semibold">
            {file.name}{' '}
            <span className="font-normal text-muted-on-light">({Math.ceil(file.size / 1024)} Ko)</span>
          </p>
        ) : (
          <p className="font-semibold">{label}</p>
        )}
        <p className="text-meta text-muted-on-light">
          {hint ?? `Formats : ${accept.join(', ')}${maxSizeMb ? ` · ${maxSizeMb} Mo maximum` : ''}`}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <button
            type="button"
            disabled={disabled}
            onClick={() => input.current?.click()}
            className="min-h-11 border-2 border-ink bg-paper px-4 font-semibold hover:bg-gold-soft disabled:cursor-not-allowed"
            aria-describedby={err ? `${id}-err` : undefined}
          >
            {file ? 'Choisir un autre fichier' : 'Parcourir mes fichiers'}
          </button>
          {file ? (
            <button
              type="button"
              onClick={() => onFile(null)}
              className="min-h-11 px-4 font-semibold underline underline-offset-4"
            >
              Retirer
            </button>
          ) : null}
        </div>
        <input
          ref={input}
          type="file"
          className="sr-only"
          tabIndex={-1}
          accept={accept.join(',')}
          onChange={(e) => {
            pick(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </div>
      {err ? (
        <p
          id={`${id}-err`}
          role="alert"
          className="mt-2 flex items-center gap-1.5 text-meta font-semibold text-bad-fg"
        >
          <Icon name="alert" size={14} />
          {err}
        </p>
      ) : null}
    </div>
  );
}
