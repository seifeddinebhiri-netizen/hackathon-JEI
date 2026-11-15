import { useDroppable } from '@dnd-kit/core';
import type { ShootingDay } from '@/api/types';
import { cn } from '@/lib/cn';
import { formatHourFr } from '@/lib/format';
import { timelineDroppableId, useCalendar } from './context';
import {
  axisHours,
  endHourOf,
  hourOf,
  pct,
  placeLabels,
  sunBands,
  sunMarks,
  type HourRange,
  DAY_LIGHT_CLASS,
  LIGHT_CLASSES,
} from './geometry';
import { useDayRange } from './hooks';
import { SceneBar, StaticSceneBar } from './SceneBar';
import { blockLabels } from './sceneText';
import { textWidth, useWidth } from './useWidth';

const BLOCK_FONT = '600 13px Inter, sans-serif';
const SUN_FONT = '400 13px Inter, sans-serif';
const BLOCK_PADDING = 22; // filet gauche + marges + place de l'icône
const SUN_ROW_H = 20;

/** Graduations horaires, centrées exactement sur leur position. */
export function TimeAxis({ range, narrow }: { range: HourRange; narrow?: boolean }) {
  return (
    <div className="relative h-5" aria-hidden>
      {axisHours(range)
        .filter((h) => !narrow || h % 2 === 0)
        .map((h) => (
          <span
            key={h}
            className="absolute top-0 -translate-x-1/2 text-label leading-5 whitespace-nowrap text-muted-on-light tabular-nums"
            style={{ left: `${pct(h, range)}%` }}
          >
            {h} h
          </span>
        ))}
    </div>
  );
}

/**
 * Frise d'une journée, zoomée sur ses scènes : graduations, blocs de scène avec un texte court,
 * puis une bande fine de lumière (nuit / jour / lumière du soir) et le lever et le coucher du soleil.
 */
export function DayTimeline({ day, compact }: { day: ShootingDay; compact?: boolean }) {
  const { sceneById, locationById } = useCalendar();
  const range = useDayRange(day);
  const { setNodeRef, isOver } = useDroppable({ id: timelineDroppableId(day.date), disabled: compact });
  const [ref, width] = useWidth<HTMLDivElement>();
  const loc = locationById.get(day.location_ids[0]);
  const bands = sunBands(day.date, loc, range);
  const narrow = width > 0 && width < 420;

  const sun = sunMarks(day.date, loc);
  const marks = [
    { text: `Lever du soleil ${formatHourFr(sun.sunrise)}`, h: hourOf(sun.sunrise) },
    { text: `Coucher ${formatHourFr(sun.sunset)}`, h: hourOf(sun.sunset) },
  ].filter((m) => m.h >= range.from && m.h <= range.to);
  const placed = width
    ? placeLabels(
        marks.map((m) => ({ x: (pct(m.h, range) / 100) * width, width: textWidth(m.text, SUN_FONT) })),
        width,
      )
    : [];
  const sunRows = placed.reduce((n, p) => Math.max(n, p.row + 1), 0);

  /** Texte du bloc : « Sc. 1 · Médina », sinon « Sc. 1 », sinon rien si le bloc est trop étroit. */
  const labelFor = (sceneId: string, start: string, end: string) => {
    const scene = sceneById.get(sceneId);
    if (!scene || !width) return '';
    const px = ((pct(endHourOf(start, end), range) - pct(hourOf(start), range)) / 100) * width;
    const { full, short } = blockLabels(scene, locationById.get(scene.location_id));
    if (textWidth(full, BLOCK_FONT) + BLOCK_PADDING <= px) return full;
    if (textWidth(short, BLOCK_FONT) + BLOCK_PADDING <= px) return short;
    return '';
  };

  return (
    <div className="px-4">
      <div ref={ref} className="relative min-w-0">
        <TimeAxis range={range} narrow={narrow} />
        <div
          ref={setNodeRef}
          className={cn(
            'relative mt-1 border-2',
            compact ? 'h-10' : 'h-14',
            isOver ? 'border-ink bg-gold-soft/40' : 'border-line-light bg-white',
          )}
        >
          {/* graduations */}
          {axisHours(range).map((h) => (
            <span
              key={h}
              aria-hidden
              className="absolute inset-y-0 w-px bg-line-light"
              style={{ left: `${pct(h, range)}%` }}
            />
          ))}
          {/* scènes */}
          <div className="absolute inset-x-0 inset-y-1">
            {day.scenes.map((s) => {
              const label = labelFor(s.scene_id, s.start, s.end);
              return compact ? (
                <StaticSceneBar key={s.scene_id} sceneId={s.scene_id} label={label} range={range} />
              ) : (
                <SceneBar key={s.scene_id} sceneId={s.scene_id} label={label} range={range} />
              );
            })}
          </div>
        </div>

        {/* lumière du jour */}
        <div aria-hidden className={cn('relative mt-2 h-1.5 overflow-hidden rounded-full', DAY_LIGHT_CLASS)}>
          {bands.map((b, i) =>
            LIGHT_CLASSES[b.kind] ? (
              <span
                key={i}
                className={cn('absolute inset-y-0', LIGHT_CLASSES[b.kind])}
                style={{ left: `${pct(b.from, range)}%`, width: `${pct(b.to, range) - pct(b.from, range)}%` }}
              />
            ) : null,
          )}
        </div>
        {sunRows ? (
          <div className="relative mt-1" style={{ height: sunRows * SUN_ROW_H }}>
            {marks.map((m, i) => (
              <span
                key={m.text}
                className="absolute text-meta leading-5 whitespace-nowrap text-muted-on-light"
                style={{ left: placed[i].left, top: placed[i].row * SUN_ROW_H }}
              >
                {m.text}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
