import type { ShootingDay } from '@/api/types';
import { cn } from '@/lib/cn';
import { DayInfo } from './DayRow';
import { DayTimeline, TimeAxis } from './DayTimeline';
import { SceneChip } from './SceneChip';

/** Mobile : une carte par jour, frise compacte puis scènes dans l'ordre (texte complet). */
export function MobileDayCard({
  day,
  index,
  highlight,
}: {
  day: ShootingDay;
  index: number;
  highlight?: boolean;
}) {
  return (
    <li
      id={`jour-${day.date}`}
      className={cn(
        'scroll-mt-20 border-2 bg-white',
        highlight ? 'border-ink shadow-hard' : 'border-line-light',
      )}
    >
      <DayInfo day={day} index={index} />
      <div className="border-t-2 border-line-light px-3 pt-2 pb-3" aria-hidden>
        <TimeAxis compact />
        <DayTimeline day={day} compact />
      </div>
      <ol className="flex flex-col gap-2 border-t-2 border-line-light p-3" aria-label="Scènes du jour">
        {day.scenes.map((s) => (
          <li key={s.scene_id}>
            <SceneChip sceneId={s.scene_id} />
          </li>
        ))}
      </ol>
    </li>
  );
}
