import { useId, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Icon, type IconName } from './Icon';

/** Choix exclusif sous forme de boutons : vrais boutons radio, navigables au clavier (flèches). */
export function SegmentedControl<T extends string>({
  legend,
  value,
  onChange,
  options,
  error,
  className,
}: {
  legend: ReactNode;
  value: T | undefined;
  onChange: (v: T) => void;
  options: { value: T; label: string; icon?: IconName }[];
  error?: string;
  className?: string;
}) {
  const name = useId();
  return (
    <fieldset className={cn('flex flex-col gap-1.5', className)}>
      <legend className="mb-1.5 text-meta font-semibold">{legend}</legend>
      <div className="flex flex-wrap border-2 border-ink">
        {options.map((o, i) => (
          <label
            key={o.value}
            className={cn(
              'relative flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-1.5 px-3 text-meta font-semibold whitespace-nowrap',
              'has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-gold has-[:focus-visible]:outline',
              i > 0 && 'border-l-2 border-ink',
              value === o.value ? 'bg-ink text-paper' : 'bg-white text-ink hover:bg-gold-soft',
            )}
          >
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
              className="sr-only"
            />
            {o.icon ? <Icon name={o.icon} size={16} /> : null}
            {o.label}
          </label>
        ))}
      </div>
      {error ? (
        <p className="flex items-center gap-1.5 text-meta font-semibold text-bad-fg">
          <Icon name="alert" size={14} />
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
