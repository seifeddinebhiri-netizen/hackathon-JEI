import { useDroppable } from '@dnd-kit/core';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Icon } from '@/components/ui';
import { cn } from '@/lib/cn';
import { isForbiddenDay } from '../../lib/rules';
import { weatherInWords } from '../../lib/labels';
import { dayDroppableId, useCalendar } from './context';

function FreeDay({ date }: { date: string }) {
  const { weatherByDate, project } = useCalendar();
  const { setNodeRef, isOver } = useDroppable({ id: dayDroppableId(date) });
  const w = weatherInWords(weatherByDate.get(date))[0];
  const closed = project.locations.filter((l) => isForbiddenDay(l, date));
  const d = parseISO(date);
  return (
    <li
      ref={setNodeRef}
      className={cn(
        'flex min-h-11 min-w-16 flex-col items-center justify-center border px-2 py-1 text-label',
        isOver ? 'border-ink bg-gold-soft' : 'border-line-light bg-white',
      )}
      title={`${format(d, 'EEEE d MMMM', { locale: fr })} · ${w.text}${closed.length ? ` · fermé : ${closed.map((l) => l.name).join(', ')}` : ''}`}
    >
      <span className="font-mono">{format(d, 'EEE d', { locale: fr })}</span>
      <span
        className={cn(
          'flex items-center gap-0.5',
          w.tone === 'bad' && 'text-bad-fg',
          w.tone === 'warn' && 'text-warn-fg',
        )}
      >
        <Icon name={w.icon} size={12} />
        <span className="sr-only">{w.text}</span>
        {closed.length ? <Icon name="door" size={12} className="text-bad-fg" /> : null}
      </span>
    </li>
  );
}

const capitalize = (s: string) => s.charAt(0).toLocaleUpperCase('fr') + s.slice(1);

/** Jours sans tournage repliés en une ligne fine, qui reste une zone de dépôt (un jour = une case). */
export function FreeDaysRow({ dates, highlight }: { dates: string[]; highlight?: boolean }) {
  const { dragging } = useCalendar();
  const first = parseISO(dates[0]);
  const last = parseISO(dates[dates.length - 1]);
  const label =
    dates.length === 1
      ? format(first, 'EEE d MMM', { locale: fr })
      : `${format(first, 'd', { locale: fr })}–${format(last, 'd MMM', { locale: fr })}`;

  // Au repos : une ligne fine et centrée, sans cadre
  if (!dragging && !highlight) {
    const text =
      dates.length === 1
        ? `${capitalize(format(first, 'EEEE d MMMM', { locale: fr }))} · pas de tournage`
        : `Du ${format(first, 'd MMMM', { locale: fr })} au ${format(last, 'd MMMM', { locale: fr })} · pas de tournage prévu`;
    return (
      <li
        id={`libre-${dates[0]}`}
        className="flex scroll-mt-32 items-center gap-4 py-1 text-meta text-muted-on-light"
      >
        <span aria-hidden className="h-px flex-1 bg-line-light" />
        <span className="text-center">{text}</span>
        <span aria-hidden className="h-px flex-1 bg-line-light" />
      </li>
    );
  }

  return (
    <li
      id={`libre-${dates[0]}`}
      className={cn(
        'flex scroll-mt-32 flex-wrap items-center gap-x-4 gap-y-2 border-2 border-dashed px-3 py-1.5',
        highlight ? 'border-ink' : 'border-line-light',
        dragging && 'bg-gold-soft/30',
      )}
    >
      <p className="eyebrow text-muted-on-light">
        {label} · {dates.length} jour{dates.length > 1 ? 's' : ''} libre{dates.length > 1 ? 's' : ''}
      </p>
      <ul className="flex flex-wrap gap-1" aria-label="Déposer sur un jour libre">
        {dates.map((d) => (
          <FreeDay key={d} date={d} />
        ))}
      </ul>
    </li>
  );
}
