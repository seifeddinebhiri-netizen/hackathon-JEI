import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { ShootingDay } from '@/api/types';
import { Icon } from '@/components/ui';
import { cn } from '@/lib/cn';
import { sceneKind, SCENE_KIND_LABELS, SCENE_KIND_SWATCH, weatherInWords } from '../../lib/labels';
import { useCalendar } from './context';

/**
 * Vue « Période » : la période de tournage seulement, une case par jour (scènes, météo, conflit).
 * Un clic ouvre le jour dans la vue « Jours de tournage ».
 */
export function PeriodView({
  days,
  onOpenDay,
}: {
  days: Map<string, ShootingDay>;
  onOpenDay: (date: string) => void;
}) {
  const { windowDates, weatherByDate, sceneById } = useCalendar();
  return (
    <div className="overflow-x-auto pb-2">
      <ol
        className="grid min-w-max gap-1.5"
        style={{ gridTemplateColumns: `repeat(${windowDates.length}, minmax(52px, 1fr))` }}
        aria-label="Période de tournage"
      >
        {windowDates.map((date) => {
          const day = days.get(date);
          const d = parseISO(date);
          const w = weatherInWords(weatherByDate.get(date))[0];
          const conflicts = day?.scenes.reduce((n, s) => n + s.conflicts.length, 0) ?? 0;
          const monday = d.getDay() === 1;
          return (
            <li key={date}>
              <button
                type="button"
                onClick={() => onOpenDay(date)}
                aria-label={`${format(d, 'EEEE d MMMM', { locale: fr })} : ${day ? `${day.scenes.length} scène(s)` : 'pas de tournage'}, ${w.text}${conflicts ? `, ${conflicts} conflit(s)` : ''}. Ouvrir le jour.`}
                className={cn(
                  'flex h-full min-h-32 w-full flex-col items-center gap-1.5 border-2 px-1 py-2 hover:border-ink',
                  day ? 'border-ink/60 bg-white' : 'border-line-light bg-paper text-muted-on-light',
                  monday && 'border-l-ink',
                )}
              >
                <span className="font-mono text-label uppercase">{format(d, 'EEE', { locale: fr })}</span>
                <span className="font-display text-h3 leading-none font-bold">{format(d, 'd')}</span>
                <span
                  className={cn(
                    'flex items-center',
                    w.tone === 'bad' && 'text-bad-fg',
                    w.tone === 'warn' && 'text-warn-fg',
                  )}
                >
                  <Icon name={w.icon} size={16} />
                </span>
                <span className="flex flex-wrap justify-center gap-1" aria-hidden>
                  {day?.scenes.map((s) => {
                    const sc = sceneById.get(s.scene_id);
                    if (!sc) return null;
                    const k = sceneKind(sc);
                    return (
                      <span
                        key={s.scene_id}
                        title={`Sc. ${sc.number} · ${SCENE_KIND_LABELS[k]}`}
                        className={cn('size-3 border-2', SCENE_KIND_SWATCH[k])}
                      />
                    );
                  })}
                </span>
                {conflicts ? (
                  <span className="mt-auto flex items-center gap-0.5 font-mono text-label text-bad-fg">
                    <Icon name="alert" size={12} />
                    {conflicts}
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
