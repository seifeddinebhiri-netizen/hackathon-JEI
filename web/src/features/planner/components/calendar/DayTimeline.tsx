import { useDroppable } from '@dnd-kit/core';
import type { ShootingDay } from '@/api/types';
import { cn } from '@/lib/cn';
import { sceneKind, SCENE_KIND_SWATCH } from '../../lib/labels';
import { timelineDroppableId, useCalendar } from './context';
import { AXIS_HOURS, hourOf, pct, SPAN, sunBands, T0 } from './geometry';
import { SceneBar, StaticSceneBar } from './SceneBar';
import { sceneLine } from './sceneText';
import { textWidth, useWidth } from './useWidth';

const BAND_CLASSES = {
  nuit: 'bg-ink/10',
  aube: 'bg-gold-soft/70',
  heure_doree: 'bg-gold/35',
} as const;

/** Graduations horaires partagées par toutes les lignes (06 h → 24 h). */
export function TimeAxis({ compact }: { compact?: boolean }) {
  return (
    <div className="relative h-6" aria-hidden>
      {AXIS_HOURS.filter((h) => !compact || h % 6 === 0).map((h) => (
        <span
          key={h}
          className="absolute top-0 -translate-x-1/2 font-mono text-label whitespace-nowrap text-muted-on-light first:translate-x-0 last:-translate-x-full"
          style={{ left: `${pct(h)}%` }}
        >
          {String(h).padStart(2, '0')} h
        </span>
      ))}
    </div>
  );
}

/**
 * Frise d'une journée : bandes de fond (aube, heure dorée, nuit), graduations, scènes à leur heure.
 * Les textes qui ne tiennent pas dans leur bande passent dessous, sans jamais se chevaucher.
 */
export function DayTimeline({ day, compact }: { day: ShootingDay; compact?: boolean }) {
  const { sceneById, locationById } = useCalendar();
  const { setNodeRef, isOver } = useDroppable({ id: timelineDroppableId(day.date), disabled: compact });
  const [ref, width] = useWidth<HTMLDivElement>();
  const loc = locationById.get(day.location_ids[0]);
  const bands = sunBands(day.date, loc);

  // Placement des libellés : dans la bande s'ils tiennent, sinon sur une ligne dessous (sans chevauchement)
  const rowsEnd: number[] = [];
  const labels: { id: string; text: string; x: number; row: number }[] = [];
  const inside = new Set<string>();
  for (const s of day.scenes) {
    const scene = sceneById.get(s.scene_id);
    if (!scene || !width) continue;
    const text = sceneLine(scene, s);
    const left = (pct(hourOf(s.start)) / 100) * width;
    const barW = ((pct(hourOf(s.end)) - pct(hourOf(s.start))) / 100) * width;
    const tw = textWidth(text);
    if (!compact && tw + 24 <= barW) {
      inside.add(s.scene_id);
      continue;
    }
    const w = tw + 22;
    const x = Math.max(0, Math.min(left, width - w));
    let row = rowsEnd.findIndex((end) => end + 12 <= x);
    if (row < 0) {
      row = rowsEnd.length;
      rowsEnd.push(0);
    }
    rowsEnd[row] = x + w;
    labels.push({ id: s.scene_id, text, x, row });
  }

  return (
    <div ref={ref} className="min-w-0">
      {!compact ? (
        <div className="relative mb-0.5 h-4" aria-hidden>
          {bands
            .filter((b) => ((b.to - b.from) / SPAN) * width > 34)
            .map((b, i) => (
              <span
                key={i}
                className="absolute top-0 px-0.5 font-mono text-label leading-4 whitespace-nowrap text-muted-on-light"
                style={{ left: `${pct(b.from)}%`, width: `${pct(b.to) - pct(b.from)}%` }}
              >
                {b.label}
              </span>
            ))}
        </div>
      ) : null}
      <div
        ref={setNodeRef}
        className={cn(
          'relative border-2 bg-white',
          compact ? 'h-12' : 'h-16',
          isOver ? 'border-ink bg-gold-soft/40' : 'border-line-light',
        )}
      >
        {/* bandes de soleil */}
        {bands.map((b, i) => (
          <div
            key={i}
            aria-hidden
            className={cn('absolute inset-y-0', BAND_CLASSES[b.kind])}
            style={{ left: `${pct(b.from)}%`, width: `${pct(b.to) - pct(b.from)}%` }}
          />
        ))}
        {/* graduations */}
        {Array.from({ length: SPAN - 1 }, (_, i) => T0 + i + 1).map((h) => (
          <span
            key={h}
            aria-hidden
            className={cn('absolute inset-y-0 w-px', h % 2 === 0 ? 'bg-line-light' : 'bg-line-light/50')}
            style={{ left: `${pct(h)}%` }}
          />
        ))}
        {/* scènes */}
        <div className={cn('absolute inset-x-0', compact ? 'inset-y-0' : 'top-2 bottom-2')}>
          {day.scenes.map((s) =>
            compact ? (
              <StaticSceneBar key={s.scene_id} sceneId={s.scene_id} />
            ) : (
              <SceneBar key={s.scene_id} sceneId={s.scene_id} showText={inside.has(s.scene_id)} />
            ),
          )}
        </div>
      </div>
      {labels.length && !compact ? (
        <div className="relative mt-1" style={{ height: rowsEnd.length * 24 }} aria-hidden>
          {labels.map((l) => {
            const scene = sceneById.get(l.id)!;
            return (
              <span
                key={l.id}
                className="absolute flex items-center gap-1.5 text-meta font-semibold whitespace-nowrap"
                style={{ left: l.x, top: l.row * 24 }}
              >
                <span
                  className={cn(
                    'inline-block size-3 shrink-0 border-l-[3px]',
                    SCENE_KIND_SWATCH[sceneKind(scene)],
                  )}
                />
                {l.text}
              </span>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
