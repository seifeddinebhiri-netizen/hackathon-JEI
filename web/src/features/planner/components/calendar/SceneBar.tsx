import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import * as Popover from '@radix-ui/react-popover';
import { Link } from 'react-router';
import { Button, Icon } from '@/components/ui';
import { cn } from '@/lib/cn';
import { MOMENT_LABELS, sceneKind, SCENE_KIND_CLASSES, SCENE_KIND_LABELS } from '../../lib/labels';
import { CONFLICT_LABELS } from '../../lib/rules';
import { ConflictList } from '../Tags';
import { useCalendar } from './context';
import { hourOf, pct } from './geometry';
import { sceneLine } from './sceneText';

/**
 * Bande d'une scène placée à sa vraie heure sur la frise. Le texte complet est dans la bande
 * quand il tient (`showText`), sinon il est affiché sous la frise ; un clic ouvre le détail.
 */
export function SceneBar({ sceneId, showText }: { sceneId: string; showText: boolean }) {
  const { sceneById, scheduledById, locationById, onMoveRequest } = useCalendar();
  const scene = sceneById.get(sceneId);
  const scheduled = scheduledById.get(sceneId);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: sceneId });
  if (!scene || !scheduled) return null;
  const kind = sceneKind(scene);
  const text = sceneLine(scene, scheduled);
  const left = pct(hourOf(scheduled.start));
  const width = Math.max(1.2, pct(hourOf(scheduled.end)) - left);
  const conflicts = scheduled.conflicts;
  const severe = conflicts.some((c) => ['pluie', 'vent', 'lieu_ferme', 'jour_trop_long'].includes(c.kind));
  const loc = locationById.get(scene.location_id);

  return (
    <Popover.Root>
      <div
        ref={setNodeRef}
        className={cn('absolute top-0 bottom-0', isDragging && 'opacity-40')}
        style={{ left: `${left}%`, width: `${width}%`, transform: CSS.Translate.toString(transform) }}
      >
        <Popover.Trigger asChild>
          <button
            type="button"
            {...listeners}
            {...attributes}
            aria-roledescription="scène déplaçable"
            aria-label={`${text}. ${SCENE_KIND_LABELS[kind]}.${conflicts.length ? ` ${conflicts.length} conflit(s) : ${conflicts.map((c) => CONFLICT_LABELS[c.kind]).join(', ')}.` : ''} Entrée pour le détail, Espace pour déplacer.`}
            className={cn(
              'flex size-full min-h-11 cursor-grab touch-none items-center gap-1 overflow-hidden border-l-[5px] px-1.5 text-left active:cursor-grabbing',
              SCENE_KIND_CLASSES[kind],
              severe && 'outline-2 -outline-offset-2 outline-bad-fg outline-dashed',
            )}
          >
            {showText ? (
              <span className="text-meta leading-tight font-semibold whitespace-nowrap">{text}</span>
            ) : (
              <span className="sr-only">{text}</span>
            )}
            {conflicts.length ? (
              <Icon name="alert" size={14} className={cn('shrink-0', showText ? 'ml-auto' : 'mx-auto')} />
            ) : null}
          </button>
        </Popover.Trigger>
      </div>
      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align="start"
          sideOffset={6}
          collisionPadding={16}
          className="z-50 w-[min(360px,calc(100vw-32px))] border-2 border-ink bg-white p-4 text-ink shadow-hard"
        >
          <p className="eyebrow text-muted-on-light">
            {SCENE_KIND_LABELS[kind]} · {MOMENT_LABELS[scene.moment]}
          </p>
          <p className="mt-1 font-semibold">{text}</p>
          {scene.summary ? <p className="mt-1 text-meta text-muted-on-light">{scene.summary}</p> : null}
          <p className="mt-1 text-meta">
            {loc?.name}
            {scene.characters.length ? ` · ${scene.characters.join(', ')}` : ''}
          </p>
          <ConflictList conflicts={conflicts} className="mt-3" />
          <div className="mt-4 flex flex-wrap gap-2">
            <Popover.Close asChild>
              <Button size="sm" variant="secondary" icon="calendar" onClick={() => onMoveRequest(sceneId)}>
                Déplacer vers…
              </Button>
            </Popover.Close>
            <Link
              to={`/planner/jour/${scheduled.start.slice(0, 10)}`}
              className="inline-flex min-h-11 items-center gap-1 px-2 text-meta font-semibold underline underline-offset-4"
            >
              <Icon name="doc" size={16} /> Feuille de service
            </Link>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** Bande inerte (frise compacte du mobile) : la scène reste déplaçable depuis la liste en dessous. */
export function StaticSceneBar({ sceneId }: { sceneId: string }) {
  const { sceneById, scheduledById } = useCalendar();
  const scene = sceneById.get(sceneId);
  const scheduled = scheduledById.get(sceneId);
  if (!scene || !scheduled) return null;
  const left = pct(hourOf(scheduled.start));
  const width = Math.max(1.2, pct(hourOf(scheduled.end)) - left);
  return (
    <div
      className={cn('absolute top-0 bottom-0 border-l-[4px]', SCENE_KIND_CLASSES[sceneKind(scene)])}
      style={{ left: `${left}%`, width: `${width}%` }}
    >
      {scheduled.conflicts.length ? <Icon name="alert" size={12} className="mx-auto mt-1" /> : null}
    </div>
  );
}
