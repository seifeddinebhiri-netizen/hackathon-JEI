import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router';
import { cn } from '@/lib/cn';
import { Icon, type IconName } from './Icon';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'on-dark';
export type ButtonSize = 'sm' | 'md' | 'lg';

const base =
  'inline-flex items-center justify-center gap-2 font-sans font-semibold whitespace-nowrap select-none ' +
  'border-2 transition-[transform,box-shadow,background-color,color] duration-100 ' +
  'disabled:cursor-not-allowed aria-disabled:cursor-not-allowed';

const variants: Record<ButtonVariant, string> = {
  // Fond #C8102E + texte blanc : contraste AA (5,9:1)
  primary:
    'bg-action border-action text-white hover:bg-action-hover hover:border-action-hover ' +
    'active:translate-x-[2px] active:translate-y-[2px] ' +
    'disabled:bg-line-light disabled:border-line-light disabled:text-muted-on-light',
  secondary:
    'bg-paper border-ink text-ink shadow-hard-sm hover:-translate-x-[1px] hover:-translate-y-[1px] hover:shadow-hard ' +
    'active:translate-x-[2px] active:translate-y-[2px] active:shadow-none ' +
    'disabled:shadow-none disabled:border-line-light disabled:text-muted-on-light disabled:translate-x-0 disabled:translate-y-0',
  ghost:
    'bg-transparent border-transparent text-ink underline-offset-4 hover:underline hover:bg-ink/5 ' +
    'disabled:text-muted-on-light disabled:no-underline',
  'on-dark':
    'bg-transparent border-paper text-paper hover:bg-paper hover:text-ink ' +
    'disabled:border-line-dark disabled:text-muted-on-dark disabled:bg-transparent',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'min-h-11 px-3 text-meta', // cible tactile ≥ 44 px même en petit
  md: 'min-h-11 px-5 text-body',
  lg: 'min-h-14 px-7 text-lead',
};

type CommonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  iconRight?: IconName;
  loading?: boolean;
  children?: ReactNode;
};

export type ButtonProps = CommonProps & ButtonHTMLAttributes<HTMLButtonElement>;

function Content({ icon, iconRight, loading, children }: CommonProps) {
  return (
    <>
      {loading ? <Spinner /> : icon ? <Icon name={icon} size={18} /> : null}
      {children}
      {iconRight && !loading ? <Icon name={iconRight} size={18} /> : null}
    </>
  );
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    icon,
    iconRight,
    loading,
    className,
    children,
    disabled,
    type = 'button',
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(base, variants[variant], sizes[size], className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      <Content icon={icon} iconRight={iconRight} loading={loading}>
        {children}
      </Content>
    </button>
  );
});

export type ButtonLinkProps = CommonProps & LinkProps;

export function ButtonLink({
  variant = 'primary',
  size = 'md',
  icon,
  iconRight,
  className,
  children,
  ...rest
}: ButtonLinkProps) {
  return (
    <Link className={cn(base, variants[variant], sizes[size], className)} {...rest}>
      <Content icon={icon} iconRight={iconRight}>
        {children}
      </Content>
    </Link>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-block size-4 animate-spin border-2 border-current border-r-transparent',
        className,
      )}
    />
  );
}
