import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

type Props = HTMLAttributes<HTMLDivElement> & {
  tone?: 'light' | 'dark' | 'gold' | 'paper';
  raised?: boolean;
  as?: 'div' | 'section' | 'article';
};

const tones = {
  light: 'bg-white border-ink text-ink',
  paper: 'bg-paper border-line-light text-ink',
  dark: 'bg-surface-dark border-line-dark text-paper',
  gold: 'bg-gold border-ink text-ink on-gold',
};

export function Card({ tone = 'light', raised, as: Tag = 'div', className, ...rest }: Props) {
  return (
    <Tag className={cn('border-2 p-5 md:p-6', tones[tone], raised && 'shadow-hard', className)} {...rest} />
  );
}
