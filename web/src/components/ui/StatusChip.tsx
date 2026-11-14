import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Icon, type IconName } from './Icon';

export type ChipTone = 'ok' | 'warn' | 'bad' | 'neutral' | 'gold' | 'dark' | 'red';

const tones: Record<ChipTone, string> = {
  ok: 'bg-ok-bg text-ok-fg border-ok-fg/30',
  warn: 'bg-warn-bg text-warn-fg border-warn-fg/30',
  bad: 'bg-bad-bg text-bad-fg border-bad-fg/30',
  neutral: 'bg-paper text-ink border-line-light',
  gold: 'bg-gold text-ink border-ink',
  dark: 'bg-ink text-paper border-ink',
  red: 'bg-brand-red text-white border-brand-red',
};

const defaultIcons: Partial<Record<ChipTone, IconName>> = { ok: 'check', warn: 'alert', bad: 'x' };

/** Pastille de statut : toujours une icône + un libellé, jamais la couleur seule. */
export function StatusChip({
  tone = 'neutral',
  icon,
  children,
  className,
  title,
}: {
  tone?: ChipTone;
  icon?: IconName | null;
  children: ReactNode;
  className?: string;
  title?: string;
}) {
  const ic = icon === null ? null : (icon ?? defaultIcons[tone]);
  return (
    <span
      title={title}
      className={cn(
        'eyebrow inline-flex items-center gap-1.5 border px-2 py-1 leading-none whitespace-nowrap',
        tones[tone],
        className,
      )}
    >
      {ic ? <Icon name={ic} size={14} /> : null}
      {children}
    </span>
  );
}
