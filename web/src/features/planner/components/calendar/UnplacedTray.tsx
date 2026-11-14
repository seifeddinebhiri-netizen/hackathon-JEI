import { useDroppable } from '@dnd-kit/core';
import type { Schedule } from '@/api/types';
import { Icon } from '@/components/ui';
import { cn } from '@/lib/cn';
import { UNPLACED_ID, useCalendar } from './context';
import { SceneChip } from './SceneChip';

/** Scènes non placées : masqué quand c'est vide, sauf pendant un déplacement (zone « retirer du planning »). */
export function UnplacedTray({ schedule, extra }: { schedule: Schedule; extra: string[] }) {
  const { dragging } = useCalendar();
  const { setNodeRef, isOver } = useDroppable({ id: UNPLACED_ID });
  const items = [
    ...schedule.unplaced,
    ...extra.map((id) => ({ scene_id: id, reason: 'Ajoutée après la génération du planning.' })),
  ];
  if (!items.length && !dragging) return null;
  return (
    <section
      ref={setNodeRef}
      aria-labelledby="non-placees-titre"
      className={cn(
        'border-2 p-3',
        isOver ? 'border-ink bg-gold-soft' : 'border-warn-fg/60 bg-warn-bg/40',
        !items.length && 'border-dashed',
      )}
    >
      <h2 id="non-placees-titre" className="eyebrow mb-2 flex items-center gap-1.5">
        <Icon name="layers" size={14} />{' '}
        {items.length ? `Non placées (${items.length})` : 'Retirer du planning'}
      </h2>
      {items.length ? (
        <ul className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
          {items.map((u) => (
            <li key={u.scene_id}>
              <SceneChip sceneId={u.scene_id} note={u.reason} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-meta text-muted-on-light">Dépose la scène ici pour la retirer du planning.</p>
      )}
    </section>
  );
}
