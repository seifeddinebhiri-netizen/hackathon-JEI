import type { ShootingDay } from '@/api/types';
import { cn } from '@/lib/cn';
import { DayInfo, SceneList } from './DayRow';
import { DayTimeline } from './DayTimeline';

/**
 * Mobile : même carte empilée que sur grand écran (en-tête, frise zoomée, liste des scènes),
 * avec une frise inerte ; les scènes se déplacent depuis la poignée de la liste.
 */
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
        'scroll-mt-24 border-2 bg-white',
        highlight ? 'border-ink shadow-hard' : 'border-line-light',
      )}
    >
      <DayInfo day={day} index={index} />
      <div className="pb-3" aria-hidden>
        <DayTimeline day={day} compact />
      </div>
      <SceneList day={day} draggable />
    </li>
  );
}
