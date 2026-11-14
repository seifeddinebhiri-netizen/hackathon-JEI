import { useDroppable } from '@dnd-kit/core';
import { Link } from 'react-router';
import type { Schedule } from '@/api/types';
import { Icon } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatDayShort } from '@/lib/format';
import { CONFLICT_ICONS } from '../../lib/labels';
import { CONFLICT_LABELS } from '../../lib/rules';
import { useCalendar, UNPLACED_ID } from './context';
import { SceneBlock } from './SceneBlock';

export function UnplacedTray({ schedule, extra }: { schedule: Schedule; extra: string[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: UNPLACED_ID });
  const items = [
    ...schedule.unplaced,
    ...extra.map((id) => ({ scene_id: id, reason: 'Ajoutée après la génération du planning.' })),
  ];
  return (
    <section
      aria-labelledby="non-placees-titre"
      ref={setNodeRef}
      className={cn('border-2 p-3', isOver ? 'border-ink bg-gold-soft' : 'border-line-light bg-white')}
    >
      <h2 id="non-placees-titre" className="eyebrow mb-2 flex items-center gap-1.5">
        <Icon name="layers" size={14} /> Non placées ({items.length})
      </h2>
      {items.length === 0 ? (
        <p className="text-meta text-muted-on-light">
          Toutes les scènes sont placées. Dépose une scène ici pour la retirer du planning.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((u) => (
            <li key={u.scene_id} className="flex flex-col gap-1">
              <SceneBlock sceneId={u.scene_id} />
              <p className="flex items-start gap-1 text-label text-muted-on-light">
                <Icon name="info" size={12} className="mt-0.5 shrink-0" />
                {u.reason}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function ConflictsPanel({ schedule }: { schedule: Schedule }) {
  const { sceneById } = useCalendar();
  const rows = schedule.days.flatMap((d) =>
    d.scenes.flatMap((s) =>
      s.conflicts.map((c, i) => ({
        key: `${d.date}-${s.scene_id}-${i}`,
        date: d.date,
        scene: sceneById.get(s.scene_id),
        c,
      })),
    ),
  );
  return (
    <section aria-labelledby="conflits-titre" className="border-2 border-line-light bg-white p-3">
      <h2 id="conflits-titre" className="eyebrow mb-2 flex items-center gap-1.5">
        <Icon name="alert" size={14} /> Conflits ({rows.length})
      </h2>
      {rows.length === 0 ? (
        <p className="flex items-center gap-1.5 text-meta text-ok-fg">
          <Icon name="check" size={14} /> Aucun conflit.
        </p>
      ) : (
        <ul className="flex max-h-[420px] flex-col divide-y divide-line-light overflow-y-auto">
          {rows.map((r) => (
            <li key={r.key} className="py-2">
              <Link to={`/planner/jour/${r.date}`} className="group flex items-start gap-2 text-meta">
                <Icon name={CONFLICT_ICONS[r.c.kind]} size={16} className="mt-0.5 shrink-0" />
                <span>
                  <span className="font-semibold group-hover:underline">
                    {CONFLICT_LABELS[r.c.kind]} · Sc. {r.scene?.number} · {formatDayShort(r.date)}
                  </span>
                  <span className="block text-muted-on-light">{r.c.message}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
