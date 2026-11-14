import * as RCheckbox from '@radix-ui/react-checkbox';
import { useId, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Icon } from './Icon';

export function Checkbox({
  checked,
  onCheckedChange,
  label,
  hint,
  disabled,
  className,
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  label: ReactNode;
  hint?: ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cn('flex min-h-11 items-start gap-3 py-1', className)}>
      <RCheckbox.Root
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={(v) => onCheckedChange(v === true)}
        aria-describedby={hint ? `${id}-aide` : undefined}
        className={cn(
          'relative mt-0.5 grid size-6 shrink-0 place-items-center border-2 border-ink bg-white',
          // zone cliquable étendue à 44 px
          'after:absolute after:-inset-[10px] after:content-[""]',
          'data-[state=checked]:bg-ink data-[state=checked]:text-gold',
          'disabled:cursor-not-allowed disabled:border-line-light disabled:bg-paper',
        )}
      >
        <RCheckbox.Indicator>
          <Icon name="check" size={16} />
        </RCheckbox.Indicator>
      </RCheckbox.Root>
      <div>
        <label
          htmlFor={id}
          className={cn('cursor-pointer', disabled && 'cursor-not-allowed text-muted-on-light')}
        >
          {label}
        </label>
        {hint ? (
          <p id={`${id}-aide`} className="text-meta text-muted-on-light">
            {hint}
          </p>
        ) : null}
      </div>
    </div>
  );
}
