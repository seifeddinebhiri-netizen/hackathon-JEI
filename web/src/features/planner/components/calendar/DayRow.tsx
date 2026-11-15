import { useDraggable, useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Link } from 'react-router';
import type { ShootingDay } from '@/api/types';
import { Icon } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatHourFr, formatHours } from '@/lib/format';
import { atTime } from '../../lib/rules';
import { dayWeatherInWords, MOMENT_TAGS, SETTING_LABELS, SETTING_SWATCH } from '../../lib/labels';
import { ConflictSentences } from './ConflictSentences';
import { dayDroppableId, useCalendar } from './context';
import { DayTimeline } from './DayTimeline';
import { durationText, sceneHeading, sceneLine, scheduledHours, timeRange } from './sceneText';

const TONE = {
  bad: 'text-bad-fg font-semibold',
  warn: 'text-warn-fg font-semibold',
  ok: 'text-ink',
  neutral: 'text-muted-on-light',
};

/**
 * En-tête du jour : date, décor en gros, rendez-vous de l'équipe, et ce que la météo implique.
 * Zone de dépôt « premier créneau libre ».
 */
export function DayInfo({ day, index }: { day: ShootingDay; index: number }) {
  const { locationById, sceneById, weatherByDate } = useCalendar();
  const { setNodeRef, isOver } = useDroppable({ id: dayDroppableId(day.date) });
  const w = weatherByDate.get(day.date) ?? day.weather;
  const locs = day.location_ids.map((id) => locationById.get(id)?.name).filter(Boolean) as string[];
  const n = day.scenes.length;
  const hours = day.scenes.reduce((t, s) => t + scheduledHours(s), 0);
  const hasExterior = day.scenes.some((s) => sceneById.get(s.scene_id)?.setting === 'EXT');
  return (
    <div ref={setNodeRef} className={cn('flex flex-col gap-1 p-3 md:p-4', isOver && 'bg-gold-soft')}>
      <p className="flex items-center justify-between gap-2">
        <span className="text-label font-semibold tracking-[0.06em] whitespace-nowrap text-muted-on-light uppercase">
          Jour {index + 1} · {format(parseISO(day.date), 'EEEE d MMMM', { locale: fr })}
        </span>
        <Link
          to={`/planner/jour/${day.date}`}
          className="inline-flex min-h-11 min-w-11 items-center justify-center hover:bg-ink/5"
          aria-label={`Feuille de service du ${format(parseISO(day.date), 'EEEE d MMMM', { locale: fr })}`}
        >
          <Icon name="doc" size={18} />
        </Link>
      </p>
      <h2 className="-mt-2 text-[22px] leading-tight">
        {locs.length ? locs.join(' et ') : 'Lieu à préciser'}
      </h2>
      <p className="text-meta">
        Rendez-vous de l’équipe à {formatHourFr(atTime(day.date, day.call_time))} · {n} scène
        {n > 1 ? 's' : ''} · {formatHours(hours)} de tournage
      </p>
      <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-meta">
        {dayWeatherInWords(w, hasExterior).map((x) => (
          <span key={x.text} className={cn('inline-flex items-center gap-1', TONE[x.tone])}>
            <Icon name={x.icon} size={14} /> {x.text}
          </span>
        ))}
      </p>
    </div>
  );
}

/** Poignée pour glisser une scène depuis la liste (mobile, où la frise est inerte). */
function DragHandle({ sceneId, label }: { sceneId: string; label: string }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: sceneId });
  return (
    <button
      ref={setNodeRef}
      type="button"
      {...listeners}
      {...attributes}
      aria-roledescription="scène déplaçable"
      aria-label={`${label}. Espace pour déplacer.`}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={cn(
        'grid min-h-11 min-w-11 shrink-0 cursor-grab touch-none place-items-center hover:bg-ink/5 active:cursor-grabbing',
        isDragging && 'opacity-40',
      )}
    >
      <Icon name="menu" size={18} />
    </button>
  );
}

/**
 * Scènes du jour, dans l'ordre : horaire en gros à gauche (au-dessus sur petit écran),
 * intitulé au format script à droite, étiquettes, puis chaque conflit en phrase avec son action.
 */
export function SceneList({ day, draggable }: { day: ShootingDay; draggable?: boolean }) {
  const { sceneById, highlightScene, onMoveRequest } = useCalendar();
  return (
    <ol className="divide-y-2 divide-line-light border-t-2 border-line-light" aria-label="Scènes du jour">
      {day.scenes.map((s) => {
        const scene = sceneById.get(s.scene_id);
        if (!scene) return null;
        return (
          <li
            key={s.scene_id}
            id={`scene-${s.scene_id}`}
            className={cn(
              'grid scroll-mt-24 gap-x-5 gap-y-1 px-3 py-3 sm:grid-cols-[180px_1fr] md:px-4',
              highlightScene === s.scene_id && 'bg-gold-soft/60',
            )}
          >
            <div className="flex items-start gap-1">
              {draggable ? <DragHandle sceneId={s.scene_id} label={sceneLine(scene, s)} /> : null}
              <div>
                <p className="font-display text-[18px] leading-tight font-bold tabular-nums">
                  {timeRange(s)}
                </p>
                <p className="text-meta text-muted-on-light">{durationText(s)}</p>
              </div>
            </div>
            <div className="min-w-0">
              <h3 className="text-body leading-snug break-words">{sceneHeading(scene)}</h3>
              <p className="mt-1.5 flex flex-wrap items-center gap-2 text-meta">
                <span className="inline-flex items-center gap-1.5 border border-line-light px-2 py-0.5">
                  <span aria-hidden className={cn('size-2.5', SETTING_SWATCH[scene.setting])} />
                  {SETTING_LABELS[scene.setting]}
                </span>
                <span className="border border-line-light px-2 py-0.5">{MOMENT_TAGS[scene.moment]}</span>
                <button
                  type="button"
                  onClick={() => onMoveRequest(s.scene_id)}
                  className="ml-auto inline-flex min-h-11 items-center px-1 font-semibold text-muted-on-light underline underline-offset-4 hover:text-ink"
                  aria-label={`Déplacer la scène ${scene.number} vers un autre jour`}
                >
                  Déplacer vers…
                </button>
              </p>
              <ConflictSentences sceneId={s.scene_id} className="mt-1" />
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** Une carte par jour de tournage : en-tête, frise zoomée, puis la liste des scènes. */
export function DayRow({ day, index, highlight }: { day: ShootingDay; index: number; highlight?: boolean }) {
  return (
    <li
      id={`jour-${day.date}`}
      className={cn(
        'scroll-mt-24 border-2 bg-white',
        highlight ? 'border-ink shadow-hard' : 'border-line-light',
      )}
    >
      <DayInfo day={day} index={index} />
      <div className="pb-3">
        <DayTimeline day={day} />
      </div>
      <SceneList day={day} />
    </li>
  );
}
