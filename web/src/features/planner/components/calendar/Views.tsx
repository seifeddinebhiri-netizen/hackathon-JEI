import {
  addDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { Link } from 'react-router';
import type { ShootingDay } from '@/api/types';
import { Icon } from '@/components/ui';
import { formatDayLong, isoDay } from '@/lib/format';
import { useCalendar } from './context';
import { DayCell } from './DayCell';
import { SceneBlock } from './SceneBlock';
import { SunTimes, WeatherSummary } from '../Tags';

const WEEKDAY_HEADERS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

export function WeekView({ weekStart, days }: { weekStart: Date; days: Map<string, ShootingDay> }) {
  const { windowDates } = useCalendar();
  const dates = Array.from({ length: 7 }, (_, i) => isoDay(addDays(weekStart, i)));
  return (
    <div className="grid grid-cols-7 gap-1.5">
      {dates.map((d) => (
        <DayCell key={d} date={d} day={days.get(d)} inWindow={windowDates.includes(d)} variant="week" />
      ))}
    </div>
  );
}

export function MonthView({ month, days }: { month: Date; days: Map<string, ShootingDay> }) {
  const { windowDates } = useCalendar();
  const dates = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
  }).map(isoDay);
  const m = format(month, 'yyyy-MM');
  return (
    <div>
      <div className="mb-1.5 grid grid-cols-7 gap-1.5" aria-hidden>
        {WEEKDAY_HEADERS.map((h) => (
          <span key={h} className="eyebrow text-center text-muted-on-light">
            {h}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {dates.map((d) => (
          <DayCell
            key={d}
            date={d}
            day={days.get(d)}
            inWindow={windowDates.includes(d)}
            variant="month"
            outsideMonth={!d.startsWith(m)}
          />
        ))}
      </div>
    </div>
  );
}

/** Mobile : liste par jour de tournage (déplacement par le menu « Déplacer vers… »). */
export function DayListView({ days }: { days: ShootingDay[] }) {
  const { weatherByDate, locationById } = useCalendar();
  if (!days.length) return <p className="text-muted-on-light">Aucun jour de tournage pour l’instant.</p>;
  return (
    <ol className="flex flex-col gap-4">
      {days.map((d, i) => (
        <li key={d.date} className="border-2 border-ink bg-white">
          <div className="flex flex-wrap items-start justify-between gap-2 border-b-2 border-ink p-3">
            <div>
              <p className="eyebrow text-muted-on-light">Jour {i + 1}</p>
              <p className="font-display text-h3 font-bold first-letter:uppercase">{formatDayLong(d.date)}</p>
              <p className="text-meta text-muted-on-light">
                RDV {d.call_time} · {d.location_ids.map((id) => locationById.get(id)?.name).join(', ')}
              </p>
            </div>
            <Link
              to={`/planner/jour/${d.date}`}
              className="inline-flex min-h-11 items-center gap-1.5 border-2 border-ink px-3 text-meta font-semibold"
            >
              <Icon name="doc" size={16} /> Feuille
            </Link>
          </div>
          <div className="flex flex-col gap-2 p-3">
            <WeatherSummary weather={weatherByDate.get(d.date) ?? d.weather} compact />
            <SunTimes weather={weatherByDate.get(d.date) ?? d.weather} />
            {d.scenes.map((s) => (
              <SceneBlock key={s.scene_id} sceneId={s.scene_id} />
            ))}
          </div>
        </li>
      ))}
    </ol>
  );
}
