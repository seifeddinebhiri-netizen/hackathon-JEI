import { useDroppable } from '@dnd-kit/core';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Link } from 'react-router';
import type { ShootingDay } from '@/api/types';
import { Icon } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatTime } from '@/lib/format';
import { weatherInWords } from '../../lib/labels';
import { dayDroppableId, useCalendar } from './context';
import { DayTimeline } from './DayTimeline';

const TONE = {
  bad: 'text-bad-fg font-semibold',
  warn: 'text-warn-fg font-semibold',
  ok: 'text-ink',
  neutral: 'text-muted-on-light',
};

/** Infos du jour : date, lieu en gros, RDV, météo en clair, soleil. Zone de dépôt « premier créneau libre ». */
export function DayInfo({ day, index }: { day: ShootingDay; index: number }) {
  const { locationById, weatherByDate } = useCalendar();
  const { setNodeRef, isOver } = useDroppable({ id: dayDroppableId(day.date) });
  const w = weatherByDate.get(day.date) ?? day.weather;
  const locs = day.location_ids.map((id) => locationById.get(id)?.name).filter(Boolean) as string[];
  return (
    <div ref={setNodeRef} className={cn('flex flex-col gap-1 p-3', isOver && 'bg-gold-soft')}>
      <p className="flex items-center justify-between gap-2">
        <span className="eyebrow whitespace-nowrap text-muted-on-light">
          J{index + 1} · {format(parseISO(day.date), 'EEE d MMM', { locale: fr })}
        </span>
        <Link
          to={`/planner/jour/${day.date}`}
          className="inline-flex min-h-11 min-w-11 items-center justify-center hover:bg-ink/5"
          aria-label={`Feuille de service du ${format(parseISO(day.date), 'EEEE d MMMM', { locale: fr })}`}
        >
          <Icon name="doc" size={18} />
        </Link>
      </p>
      <p className="-mt-2 font-display text-[20px] leading-tight font-bold">{locs[0] ?? 'Lieu à préciser'}</p>
      {locs.length > 1 ? <p className="text-meta">+ {locs.slice(1).join(', ')}</p> : null}
      <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-meta">
        <strong>RDV {day.call_time}</strong>
        {weatherInWords(w).map((x) => (
          <span key={x.text} className={cn('inline-flex items-center gap-1', TONE[x.tone])}>
            <Icon name={x.icon} size={14} /> {x.text}
          </span>
        ))}
      </p>
      {w ? (
        <p className="flex items-center gap-3 text-meta text-muted-on-light">
          <span className="inline-flex items-center gap-1">
            <Icon name="sunrise" size={14} /> {formatTime(w.sunrise)}
          </span>
          <span className="inline-flex items-center gap-1">
            <Icon name="sunset" size={14} /> {formatTime(w.sunset)}
          </span>
        </p>
      ) : null}
    </div>
  );
}

/** Une ligne large par jour de tournage : infos à gauche, frise horaire à droite. */
export function DayRow({ day, index, highlight }: { day: ShootingDay; index: number; highlight?: boolean }) {
  return (
    <li
      id={`jour-${day.date}`}
      className={cn(
        'grid scroll-mt-32 grid-cols-[240px_1fr] items-stretch border-2 bg-white',
        highlight ? 'border-ink shadow-hard' : 'border-line-light',
      )}
    >
      <div className="border-r-2 border-line-light">
        <DayInfo day={day} index={index} />
      </div>
      <div className="flex flex-col justify-center p-3">
        <DayTimeline day={day} />
      </div>
    </li>
  );
}
