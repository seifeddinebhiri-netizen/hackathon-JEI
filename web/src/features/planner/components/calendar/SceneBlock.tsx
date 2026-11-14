import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Icon } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatTime } from '@/lib/format';
import { MOMENT_ICONS, MOMENT_LABELS } from '../../lib/labels';
import { CONFLICT_LABELS } from '../../lib/rules';
import { useCalendar } from './context';

/** Bloc de scène déplaçable (souris, toucher, clavier) + bouton « Déplacer vers… ». */
export function SceneBlock({
  sceneId,
  compact,
  overlay,
  hideLocation,
}: {
  sceneId: string;
  compact?: boolean;
  overlay?: boolean;
  /** Le lieu est déjà indiqué en tête de la journée */
  hideLocation?: boolean;
}) {
  const { sceneById, scheduledById, locationById, onMoveRequest } = useCalendar();
  const scene = sceneById.get(sceneId);
  const scheduled = scheduledById.get(sceneId);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: sceneId,
    disabled: overlay,
  });
  if (!scene) return null;
  const conflicts = scheduled?.conflicts ?? [];
  const loc = locationById.get(scene.location_id);
  const describe = `Scène ${scene.number}, ${scene.title}, ${scene.setting === 'EXT' ? 'extérieur' : 'intérieur'}, ${MOMENT_LABELS[scene.moment]}${
    scheduled ? `, de ${formatTime(scheduled.start)} à ${formatTime(scheduled.end)}` : ''
  }${conflicts.length ? `, ${conflicts.length} conflit(s) : ${conflicts.map((c) => CONFLICT_LABELS[c.kind]).join(', ')}` : ''}`;

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={cn(
        'group relative flex border-l-[6px] text-left',
        scene.setting === 'EXT' ? 'border-ink bg-ext' : 'border-muted-on-light bg-int',
        conflicts.some((c) => c.kind === 'pluie' || c.kind === 'vent' || c.kind === 'lieu_ferme') &&
          'outline-2 outline-bad-fg outline-dashed',
        isDragging && 'opacity-40',
        overlay && 'shadow-hard rotate-1',
      )}
    >
      <button
        type="button"
        {...listeners}
        {...attributes}
        aria-label={`${describe}. Appuie sur Espace pour déplacer.`}
        aria-roledescription="scène déplaçable"
        className={cn(
          'flex min-h-11 flex-1 cursor-grab touch-none flex-col gap-0.5 px-2 py-1.5 text-left active:cursor-grabbing',
          compact && 'py-1',
        )}
      >
        <span className="flex items-center gap-1.5 font-mono text-label font-medium whitespace-nowrap">
          <span className="border border-ink bg-white px-1">{scene.setting}</span>
          <Icon name={MOMENT_ICONS[scene.moment]} size={14} />
          <span>Sc. {scene.number}</span>
          {conflicts.length ? (
            <span className="ml-auto inline-flex items-center gap-0.5 text-bad-fg">
              <Icon name="alert" size={14} />
              {conflicts.length}
            </span>
          ) : null}
        </span>
        {!compact ? (
          <>
            <span className="line-clamp-2 text-meta leading-tight font-semibold">{scene.title}</span>
            <span className="text-label text-muted-on-light">
              {scheduled
                ? `${formatTime(scheduled.start)} – ${formatTime(scheduled.end)}`
                : `${scene.estimated_hours} h`}
              {loc && !hideLocation ? ` · ${loc.name}` : ''}
            </span>
          </>
        ) : null}
      </button>
      {!overlay ? (
        <button
          type="button"
          onClick={() => onMoveRequest(sceneId)}
          className="grid w-9 shrink-0 place-items-center border-l border-ink/20 hover:bg-ink/10"
          aria-label={`Déplacer la scène ${scene.number} vers…`}
        >
          <Icon name="calendar" size={16} />
        </button>
      ) : null}
    </div>
  );
}
