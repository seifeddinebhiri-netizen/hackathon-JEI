import { Link } from 'react-router';
import { brand } from '@/app/brand';
import { cn } from '@/lib/cn';

/** Logo du pack (SVG sans fond) : version pour fond sombre ou pour fond clair. */
export function LogoImage({
  onDark = true,
  height = 40,
  className,
}: {
  onDark?: boolean;
  height?: number;
  className?: string;
}) {
  return (
    <img
      src={onDark ? brand.logos.onDark : brand.logos.onLight}
      alt={brand.name}
      height={height}
      width={Math.round(height * brand.logoRatio)}
      className={cn('block h-auto max-w-none', className)}
      style={{ height, width: Math.round(height * brand.logoRatio) }}
      decoding="async"
    />
  );
}

/** Logo cliquable (navigation, pied de page). */
export function Logo({
  to = '/',
  onDark = true,
  height = 44,
  className,
}: {
  to?: string;
  onDark?: boolean;
  height?: number;
  className?: string;
}) {
  return (
    <Link
      to={to}
      className={cn('inline-flex min-h-11 items-center', className)}
      aria-label={`${brand.name}, accueil`}
    >
      <LogoImage onDark={onDark} height={height} className="pointer-events-none" />
    </Link>
  );
}
