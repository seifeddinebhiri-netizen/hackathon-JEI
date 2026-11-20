import { Link } from 'react-router';
import { Icon } from '@/components/ui';
import { cn } from '@/lib/cn';
import { useCalendar } from './context';
import { useSceneSentences } from './hooks';

const actionClass =
  'inline-flex min-h-11 items-center font-semibold underline decoration-1 underline-offset-4 hover:decoration-2';

/** Conflits d'une scène : une phrase en orange foncé par conflit, avec l'action qui le règle. */
export function ConflictSentences({ sceneId, className }: { sceneId: string; className?: string }) {
  const { scheduledById, onMoveRequest, onShift } = useCalendar();
  const sentences = useSceneSentences(sceneId);
  if (!sentences.length) return null;
  const date = scheduledById.get(sceneId)?.start.slice(0, 10);
  return (
    <ul className={cn('flex flex-col gap-1.5', className)} aria-label="À régler">
      {sentences.map((s) => {
        const a = s.action;
        return (
          <li key={s.key} className="flex items-start gap-2 text-meta text-conflict">
            <Icon name="alert" size={16} className="mt-0.5 shrink-0" />
            <span>
              <span className="font-semibold">{s.text}</span>
              {a ? (
                <span className="block">
                  {a.kind === 'link' ? (
                    <Link to={a.to} className={cn(actionClass, '-my-2')}>
                      {a.label}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      className={cn(actionClass, '-my-2')}
                      onClick={() =>
                        a.kind === 'move' ? onMoveRequest(sceneId) : date && onShift(sceneId, date, a.hhmm)
                      }
                    >
                      {a.label}
                    </button>
                  )}
                </span>
              ) : null}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
