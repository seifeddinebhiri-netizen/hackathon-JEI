import type { CSSProperties, ReactNode } from 'react';
import type { Status } from '@/data/status';

export const asset = (p: string) => `${import.meta.env.BASE_URL}${p}`;

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

/** Coins de viseur rouges + carré rouge : le motif du logo et du premier pitch */
export function Corners({
  inset = 60,
  size = 50,
  stroke = 6,
  color = 'var(--color-brand-red)',
  square = false,
  className,
}: {
  inset?: number;
  size?: number;
  stroke?: number;
  color?: string;
  square?: boolean;
  className?: string;
}) {
  const s = (pos: CSSProperties, b: CSSProperties) => (
    <span aria-hidden className="absolute block" style={{ width: size, height: size, ...pos, ...b }} />
  );
  const line = `${stroke}px solid ${color}`;
  return (
    <div aria-hidden className={cx('pointer-events-none absolute', className)} style={{ inset }}>
      {s({ left: 0, top: 0 }, { borderLeft: line, borderTop: line })}
      {s({ right: 0, top: 0 }, { borderRight: line, borderTop: line })}
      {s({ left: 0, bottom: 0 }, { borderLeft: line, borderBottom: line })}
      {square ? (
        <span className="absolute block" style={{ right: 0, bottom: 0, width: 22, height: 22, background: color }} />
      ) : (
        s({ right: 0, bottom: 0 }, { borderRight: line, borderBottom: line })
      )}
    </div>
  );
}

/** Bande de perforations (pied des slides du premier pitch) */
export function PerfBand({
  dark = true,
  className,
  style,
  label,
}: {
  dark?: boolean;
  className?: string;
  style?: CSSProperties;
  label?: ReactNode;
}) {
  return (
    <div
      aria-hidden={!label}
      className={cx('absolute right-0 bottom-0 left-0 flex h-[52px] items-center', dark ? 'bg-ink' : 'bg-paper', className)}
      style={style}
    >
      <div
        className="perfs ml-10 h-[16px] flex-1"
        style={{ ['--perf-color' as string]: dark ? 'var(--color-paper)' : 'var(--color-ink)' }}
      />
      <div className="eyebrow w-[180px] pr-10 text-right text-[20px] text-gold">{label}</div>
    </div>
  );
}

export function Eyebrow({ children, className, color = 'text-brand-red' }: { children: ReactNode; className?: string; color?: string }) {
  return <p className={cx('eyebrow text-[22px]', color, className)}>{children}</p>;
}

/** Capture réelle de l'application, dans le cadre du premier pitch (bord noir + ombre décalée) */
export function Shot({
  src,
  alt,
  className,
  style,
  shadow = 'gold',
  label,
  position = 'top left',
  border = true,
}: {
  src: string;
  alt: string;
  className?: string;
  style?: CSSProperties;
  shadow?: 'gold' | 'red' | 'ink' | 'none';
  label?: ReactNode;
  position?: string;
  border?: boolean;
}) {
  const sh =
    shadow === 'gold'
      ? '14px 14px 0 var(--color-gold)'
      : shadow === 'red'
        ? '14px 14px 0 var(--color-brand-red)'
        : shadow === 'ink'
          ? '12px 12px 0 var(--color-ink)'
          : 'none';
  return (
    <figure className={cx('shot absolute m-0', className)} style={style}>
      <div
        className={cx('h-full w-full overflow-hidden bg-white', border && 'border-[4px] border-ink')}
        style={{ boxShadow: sh }}
      >
        <img src={asset(src)} alt={alt} draggable={false} style={{ objectPosition: position }} />
      </div>
      {label ? (
        <figcaption className="eyebrow absolute -bottom-[58px] left-0 bg-gold px-4 py-2 text-[17px] text-ink">
          {label}
        </figcaption>
      ) : null}
    </figure>
  );
}

const STATUS_STYLE: Record<Status, { cls: string; icon: ReactNode; label: string }> = {
  fait: {
    cls: 'bg-ok-bg text-ok-fg border-ok-fg',
    label: 'Réalisé',
    icon: <path d="M4 10.5l4 4 8-9" fill="none" stroke="currentColor" strokeWidth="2.6" />,
  },
  'en-cours': {
    cls: 'bg-warn-bg text-warn-fg border-warn-fg',
    label: 'En cours',
    icon: (
      <>
        <circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" strokeWidth="2.4" />
        <path d="M10 3a7 7 0 0 1 0 14z" fill="currentColor" />
      </>
    ),
  },
  prochainement: {
    cls: 'bg-white text-muted-on-light border-muted-on-light border-dashed',
    label: 'Prochainement',
    icon: <circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeDasharray="3 3" />,
  },
};

/** Statut = icône + libellé, jamais la couleur seule (règle du design system) */
export function StatusChip({ status, label, className }: { status: Status; label?: string; className?: string }) {
  const s = STATUS_STYLE[status];
  return (
    <span className={cx('eyebrow inline-flex items-center gap-2 border-2 px-3 py-1 text-[16px]', s.cls, className)}>
      <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden>
        {s.icon}
      </svg>
      {label ?? s.label}
    </span>
  );
}

/** Le badge « Brouillon IA : à valider » de l'application */
export function AiDraft({ className, validated }: { className?: string; validated?: boolean }) {
  return validated ? (
    <span className={cx('eyebrow inline-flex items-center gap-2 border-2 border-ok-fg bg-ok-bg px-3 py-1 text-[16px] text-ok-fg', className)}>
      <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden>
        <path d="M4 10.5l4 4 8-9" fill="none" stroke="currentColor" strokeWidth="2.6" />
      </svg>
      Validé par toi
    </span>
  ) : (
    <span className={cx('eyebrow inline-flex items-center gap-2 border-2 border-dashed border-warn-fg bg-gold-soft px-3 py-1 text-[16px] text-warn-fg', className)}>
      <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden>
        <path d="M10 2l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" fill="currentColor" />
      </svg>
      Brouillon IA : à valider
    </span>
  );
}

export function Logo({ light, className, style }: { light?: boolean; className?: string; style?: CSSProperties }) {
  return (
    <img
      src={asset(`brand/encadre-logo-transparent-pour-fond-${light ? 'clair' : 'sombre'}.svg`)}
      alt="encadré"
      className={className}
      style={style}
      draggable={false}
    />
  );
}
