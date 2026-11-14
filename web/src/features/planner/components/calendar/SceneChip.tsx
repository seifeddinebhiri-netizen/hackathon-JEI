import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Icon } from '@/components/ui';
import { cn } from '@/lib/cn';
import { MOMENT_ICONS, sceneKind, SCENE_KIND_CLASSES, SCENE_KIND_LABELS } from '../../lib/labels';
import { CONFLICT_LABELS } from '../../lib/rules';
import { useCalendar } from './context';
import { sceneLine } from './sceneText';

/**
 * Scène en pleine largeur avec son texte complet (jamais coupé) : scènes non placées, vue mobile,
 * aperçu pendant le glisser-déposer.
 */
export function SceneChip({ sceneId, overlay, note }: { sceneId: string; overlay?: boolean; note?: string }) {
  const { sceneById, scheduledById, onMoveRequest } = useCalendar();
  const scene = sceneById.get(sceneId);
  const scheduled = scheduledById.get(sceneId);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: sceneId,
    disabled: overlay,
  });
  if (!scene) return null;
  const kind = sceneKind(scene);
  const conflicts = scheduled?.conflicts ?? [];
  const text = sceneLine(scene, scheduled);

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={cn(
        'flex border-l-[6px]',
        SCENE_KIND_CLASSES[kind],
        isDragging && 'opacity-40',
        overlay && 'shadow-hard',
      )}
    >
      <button
        type="button"
        {...listeners}
        {...attributes}
        aria-roledescription="scène déplaçable"
        aria-label={`${text}. ${SCENE_KIND_LABELS[kind]}.${conflicts.length ? ` ${conflicts.length} conflit(s) : ${conflicts.map((c) => CONFLICT_LABELS[c.kind]).join(', ')}.` : ''} Espace pour déplacer.`}
        className="flex min-h-11 flex-1 cursor-grab touch-none items-start gap-2 px-3 py-2 text-left active:cursor-grabbing"
      >
        <Icon name={MOMENT_ICONS[scene.moment]} size={16} className="mt-0.5 shrink-0" />
        <span className="flex-1">
          <span className="block text-meta font-semibold">{text}</span>
          <span className="eyebrow mt-0.5 block opacity-80">{SCENE_KIND_LABELS[kind]}</span>
          {note ? <span className="mt-1 block text-meta opacity-90">{note}</span> : null}
        </span>
        {conflicts.length ? (
          <span className="flex shrink-0 items-center gap-0.5 font-mono text-label font-medium">
            <Icon name="alert" size={14} />
            {conflicts.length}
          </span>
        ) : null}
      </button>
      {!overlay ? (
        <button
          type="button"
          onClick={() => onMoveRequest(sceneId)}
          className="grid w-11 shrink-0 place-items-center border-l border-current/20 hover:bg-current/10"
          aria-label={`Déplacer la scène ${scene.number} vers…`}
        >
          <Icon name="calendar" size={16} />
        </button>
      ) : null}
    </div>
  );
}
