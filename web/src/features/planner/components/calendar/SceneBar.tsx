import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import * as Popover from '@radix-ui/react-popover';
import { Link } from 'react-router';
import { Button, Icon } from '@/components/ui';
import { cn } from '@/lib/cn';
import { MOMENT_TAGS, sceneKind, SCENE_KIND_CLASSES, SETTING_LABELS } from '../../lib/labels';
import { ConflictSentences } from './ConflictSentences';
import { useCalendar } from './context';
import { endHourOf, hourOf, pct, type HourRange } from './geometry';
import { sceneHeading, sceneLine } from './sceneText';
import { useSceneSentences } from './hooks';

function position(start: string, end: string, range: HourRange) {
  const left = pct(hourOf(start), range);
  return { left, width: Math.max(1.2, pct(endHourOf(start, end), range) - left) };
}

/**
 * Bloc d'une scène placée à sa vraie heure sur la frise, avec un texte court (`label`, peut être vide
 * si le bloc est trop étroit). L'icône ⚠ signale un conflit ; la phrase complète est dans
 * l'aria-label et dans la bulle ouverte au clic. Le bloc se glisse vers un autre jour ou une autre heure.
 */
export function SceneBar({ sceneId, label, range }: { sceneId: string; label: string; range: HourRange }) {
  const { sceneById, scheduledById, locationById, onMoveRequest } = useCalendar();
  const scene = sceneById.get(sceneId);
  const scheduled = scheduledById.get(sceneId);
  const sentences = useSceneSentences(sceneId);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: sceneId });
  if (!scene || !scheduled) return null;
  const kind = sceneKind(scene);
  const { left, width } = position(scheduled.start, scheduled.end, range);
  const loc = locationById.get(scene.location_id);
  const problems = sentences.map((s) => s.text).join(' ');

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
            aria-label={`${sceneLine(scene, scheduled)}.${problems ? ` À régler : ${problems}` : ''} Entrée pour le détail, Espace pour déplacer.`}
            title={problems || undefined}
            className={cn(
              'flex size-full min-h-11 cursor-grab touch-none items-center gap-1 overflow-hidden rounded-sm border-l-[5px] px-1.5 text-left active:cursor-grabbing',
              SCENE_KIND_CLASSES[kind],
            )}
          >
            {label ? (
              <span className="text-meta leading-tight font-semibold whitespace-nowrap">{label}</span>
            ) : null}
            {sentences.length ? (
              <Icon name="alert" size={14} className={cn('shrink-0', label ? 'ml-auto' : 'mx-auto')} />
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
          className="z-50 w-[min(380px,calc(100vw-32px))] border-2 border-ink bg-white p-4 text-ink shadow-hard"
        >
          <p className="font-display font-bold">{sceneHeading(scene)}</p>
          <p className="mt-1 text-meta text-muted-on-light">
            {SETTING_LABELS[scene.setting]} · {MOMENT_TAGS[scene.moment]}
            {loc ? ` · ${loc.name}` : ''}
          </p>
          {scene.summary ? <p className="mt-2 text-meta">{scene.summary}</p> : null}
          <ConflictSentences sceneId={sceneId} className="mt-3" />
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

/** Bloc inerte (frise compacte du mobile) : la scène reste déplaçable depuis la liste en dessous. */
export function StaticSceneBar({
  sceneId,
  label,
  range,
}: {
  sceneId: string;
  label: string;
  range: HourRange;
}) {
  const { sceneById, scheduledById } = useCalendar();
  const sentences = useSceneSentences(sceneId);
  const scene = sceneById.get(sceneId);
  const scheduled = scheduledById.get(sceneId);
  if (!scene || !scheduled) return null;
  const { left, width } = position(scheduled.start, scheduled.end, range);
  return (
    <div
      className={cn(
        'absolute top-0 bottom-0 flex items-center gap-1 overflow-hidden rounded-sm border-l-[4px] px-1',
        SCENE_KIND_CLASSES[sceneKind(scene)],
      )}
      style={{ left: `${left}%`, width: `${width}%` }}
    >
      {label ? <span className="text-label font-semibold whitespace-nowrap">{label}</span> : null}
      {sentences.length ? <Icon name="alert" size={12} className="ml-auto shrink-0" /> : null}
    </div>
  );
}
