import type { FestivalRequirement } from '@/api/types';
import { ButtonLink, Button, Icon, type IconName } from '@/components/ui';
import { cn } from '@/lib/cn';
import { PIECE_STATE_LABELS, type Piece, type PieceState } from '../lib/dossier';

const STATE_STYLE: Record<PieceState, { icon: IconName; box: string }> = {
  bloquant: { icon: 'x', box: 'border-bad-fg bg-bad-bg text-bad-fg' },
  a_faire: { icon: 'minus', box: 'border-warn-fg bg-warn-bg text-warn-fg' },
  pret: { icon: 'check', box: 'border-ok-fg bg-ok-bg text-ok-fg' },
};

export function PieceStateIcon({ state }: { state: PieceState }) {
  const s = STATE_STYLE[state];
  return (
    <span className={cn('grid size-7 shrink-0 place-items-center border-2', s.box)}>
      <Icon name={s.icon} size={16} />
      <span className="sr-only">{PIECE_STATE_LABELS[state]} : </span>
    </span>
  );
}

/** Liste des pièces d'un dossier, chacune avec son état (icône + libellé) et son action. */
export function PiecesList({
  pieces,
  onToggle,
  busy,
  compact,
}: {
  pieces: Piece[];
  onToggle?: (r: FestivalRequirement, done: boolean) => void;
  busy?: boolean;
  compact?: boolean;
}) {
  return (
    <ol className="flex flex-col">
      {pieces.map((p) => (
        <li
          key={p.key}
          className={cn(
            'flex flex-wrap items-start gap-3 border-b border-line-light py-3 last:border-b-0',
            p.state === 'bloquant' && 'bg-bad-bg/40 px-2',
          )}
        >
          <PieceStateIcon state={p.state} />
          <span className="flex min-w-0 flex-1 basis-48 flex-col">
            <span className="font-semibold">{p.title}</span>
            <span className="text-meta text-muted-on-light">{p.detail}</span>
            {!compact && p.requirement !== p.detail ? (
              <span className="text-meta text-muted-on-light">
                <span className="font-semibold">Le festival demande : </span>
                {p.requirement}
              </span>
            ) : null}
          </span>
          {p.action ? (
            'to' in p.action ? (
              <ButtonLink
                to={p.action.to}
                size="sm"
                variant={p.state === 'bloquant' ? 'primary' : 'secondary'}
                className="shrink-0"
              >
                {p.action.label}
              </ButtonLink>
            ) : onToggle ? (
              <Button
                size="sm"
                variant="secondary"
                className="shrink-0"
                disabled={busy}
                onClick={() =>
                  onToggle((p.action as { toggle: FestivalRequirement }).toggle, p.state !== 'pret')
                }
              >
                {p.action.label}
              </Button>
            ) : null
          ) : null}
        </li>
      ))}
    </ol>
  );
}

/** Barre de progression : pièces prêtes sur le total. */
export function PiecesProgress({
  ready,
  total,
  className,
}: {
  ready: number;
  total: number;
  className?: string;
}) {
  const pct = total ? Math.round((ready / total) * 100) : 100;
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <p className="text-meta font-semibold">
        {ready} pièce{ready > 1 ? 's' : ''} sur {total}
      </p>
      <div
        role="progressbar"
        aria-label="Pièces prêtes"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={ready}
        className="h-2.5 w-full bg-line-light"
      >
        <div className="h-full bg-ink" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
