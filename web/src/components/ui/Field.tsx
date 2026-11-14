import {
  cloneElement,
  forwardRef,
  isValidElement,
  useId,
  type InputHTMLAttributes,
  type ReactElement,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { cn } from '@/lib/cn';
import { Icon } from './Icon';

const control =
  'w-full min-h-11 border-2 border-ink bg-white px-3 py-2 text-body text-ink placeholder:text-muted-on-light ' +
  'hover:border-ink focus-visible:outline-[3px] ' +
  'aria-[invalid=true]:border-bad-fg aria-[invalid=true]:bg-bad-bg/40 ' +
  'disabled:cursor-not-allowed disabled:border-line-light disabled:bg-paper disabled:text-muted-on-light';

type ControlProps = { 'aria-describedby'?: string; 'aria-invalid'?: boolean; id?: string };

/**
 * Libellé + aide + erreur autour d'un contrôle. Injecte id, aria-describedby et aria-invalid.
 */
export function Field({
  label,
  hint,
  error,
  required,
  optional,
  children,
  className,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  optional?: boolean;
  children: ReactElement<ControlProps>;
  className?: string;
}) {
  const id = useId();
  const hintId = `${id}-aide`;
  const errId = `${id}-erreur`;
  const describedBy = [hint ? hintId : null, error ? errId : null].filter(Boolean).join(' ') || undefined;
  const child = isValidElement(children)
    ? cloneElement(children, {
        id: children.props.id ?? id,
        'aria-describedby': describedBy,
        'aria-invalid': !!error || undefined,
      })
    : children;
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label
        htmlFor={(isValidElement(children) && children.props.id) || id}
        className="text-meta font-semibold text-ink"
      >
        {label}
        {required ? (
          <span aria-hidden className="text-action">
            {' '}
            *
          </span>
        ) : null}
        {optional ? <span className="font-normal text-muted-on-light"> (facultatif)</span> : null}
      </label>
      {child}
      {hint ? (
        <p id={hintId} className="text-meta text-muted-on-light">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errId} className="flex items-center gap-1.5 text-meta font-semibold text-bad-fg">
          <Icon name="alert" size={14} />
          {error}
        </p>
      ) : null}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...rest },
  ref,
) {
  return <input ref={ref} className={cn(control, className)} {...rest} />;
});

export const TextArea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function TextArea({ className, rows = 4, ...rest }, ref) {
    return (
      <textarea
        ref={ref}
        rows={rows}
        className={cn(control, 'resize-y leading-relaxed', className)}
        {...rest}
      />
    );
  },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...rest },
  ref,
) {
  return (
    <div className="relative">
      <select ref={ref} className={cn(control, 'appearance-none pr-10', className)} {...rest}>
        {children}
      </select>
      <Icon
        name="chevronDown"
        size={18}
        className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-ink"
      />
    </div>
  );
});

/** Compteur de caractères comparé à une limite (synopsis, bio…). */
export function CharCount({ value, limit }: { value: string; limit?: number }) {
  const n = value.length;
  const over = limit !== undefined && n > limit;
  return (
    <p
      className={cn('eyebrow flex items-center gap-1.5', over ? 'text-bad-fg' : 'text-muted-on-light')}
      aria-live="polite"
    >
      {over ? <Icon name="alert" size={14} /> : null}
      {n}
      {limit !== undefined ? ` / ${limit}` : ''} caractères{over ? ' : trop long' : ''}
    </p>
  );
}
