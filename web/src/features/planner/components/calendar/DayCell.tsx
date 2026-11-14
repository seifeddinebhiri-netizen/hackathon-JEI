import { useDroppable } from '@dnd-kit/core';
import { Link } from 'react-router';
import type { ShootingDay } from '@/api/types';
import { Icon } from '@/components/ui';
import { cn } from '@/lib/cn';
import { toDate } from '@/lib/format';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { isForbiddenDay, isRainy, isWeatherKnown, isWindy } from '../../lib/rules';
import { useCalendar, dayDroppableId } from './context';
import { SceneBlock } from './SceneBlock';

function WeatherDot({ date }: { date: string }) {
  const { weatherByDate } = useCalendar();
  const w = weatherByDate.get(date);
  if (!w) return null;
  if (!isWeatherKnown(w))
    return (
      <span className="inline-flex items-center gap-0.5 text-label text-warn-fg" title="Météo à revérifier">
        <Icon name="cloud" size={14} />?<span className="sr-only">Météo à revérifier</span>
      </span>
    );
  if (isRainy(w))
    return (
      <span
        className="inline-flex items-center gap-0.5 text-label font-semibold text-bad-fg"
        title={`Pluie ${w.rain_pct} %`}
      >
        <Icon name="rain" size={14} />
        {w.rain_pct}%<span className="sr-only"> de pluie</span>
      </span>
    );
  if (isWindy(w))
    return (
      <span
        className="inline-flex items-center gap-0.5 text-label font-semibold text-bad-fg"
        title={`Vent ${w.wind_kmh} km/h`}
      >
        <Icon name="wind" size={14} />
        {w.wind_kmh}
        <span className="sr-only"> km/h de vent</span>
      </span>
    );
  return (
    <span className="inline-flex items-center gap-0.5 text-label" title={`Pluie ${w.rain_pct} %`}>
      <Icon name={w.cloud_pct > 50 ? 'cloud' : 'sun'} size={14} />
      <span className="sr-only">Temps sec</span>
    </span>
  );
}

export function DayCell({
  date,
  day,
  inWindow,
  variant,
  outsideMonth,
}: {
  date: string;
  day?: ShootingDay;
  inWindow: boolean;
  variant: 'week' | 'month';
  outsideMonth?: boolean;
}) {
  const { locationById, project } = useCalendar();
  const { setNodeRef, isOver } = useDroppable({
    id: dayDroppableId(date),
    disabled: !inWindow,
    data: { date },
  });
  const d = toDate(date);
  const closedLocs = project.locations.filter((l) => isForbiddenDay(l, date));
  const today = format(new Date(), 'yyyy-MM-dd') === date;

  return (
    <div
      ref={setNodeRef}
      aria-label={format(d, 'EEEE d MMMM', { locale: fr })}
      className={cn(
        'flex min-w-0 flex-col gap-1.5 border-2 p-1.5',
        variant === 'week' ? 'min-h-72' : 'min-h-32',
        inWindow ? 'border-line-light bg-white' : 'border-transparent bg-paper text-muted-on-light',
        outsideMonth && 'opacity-50',
        isOver && 'border-ink bg-gold-soft',
      )}
    >
      <div className="flex items-start justify-between gap-1">
        {day ? (
          <Link
            to={`/planner/jour/${date}`}
            className="inline-flex min-h-8 items-center gap-1 font-semibold underline-offset-2 hover:underline"
            title="Ouvrir la feuille de service"
          >
            <span className={cn('font-mono text-label', today && 'bg-ink px-1 text-paper')}>
              {variant === 'week' ? format(d, 'EEE d', { locale: fr }) : format(d, 'd')}
            </span>
            <Icon name="doc" size={14} />
            <span className="sr-only">Feuille de service</span>
          </Link>
        ) : (
          <span
            className={cn(
              'inline-flex min-h-8 items-center font-mono text-label',
              today && 'bg-ink px-1 text-paper',
            )}
          >
            {variant === 'week' ? format(d, 'EEE d', { locale: fr }) : format(d, 'd')}
          </span>
        )}
        {inWindow ? <WeatherDot date={date} /> : null}
      </div>
      {inWindow && day && variant === 'week' ? (
        <p className="truncate text-label text-muted-on-light">
          RDV {day.call_time} ·{' '}
          {day.location_ids
            .map((id) => locationById.get(id)?.name)
            .filter(Boolean)
            .join(', ')}
        </p>
      ) : null}
      {inWindow && closedLocs.length && variant === 'week' ? (
        <p className="flex items-center gap-1 text-label text-bad-fg">
          <Icon name="door" size={12} /> Fermé : {closedLocs.map((l) => l.name).join(', ')}
        </p>
      ) : null}
      {day?.scenes.map((s) => (
        <SceneBlock key={s.scene_id} sceneId={s.scene_id} compact={variant === 'month'} />
      ))}
    </div>
  );
}
