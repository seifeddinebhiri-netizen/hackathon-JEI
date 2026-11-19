import type { Timeline } from '@/api/types';
import { Button } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatSeconds, segmentIndexAt } from '../plan/timeline';
import type { ClockPhase } from '../useShotClock';

const SHADOW = '[text-shadow:0_1px_6px_rgb(18_17_16/0.95)]';
const mmss = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/**
 * La chronologie d'un plan en mouvement, pendant la prise : le temps écoulé, le passage en cours (ce que
 * l'IA a décrit), et ce qui arrive ensuite, avec le compte à rebours.
 */
export function TimelineStrip({
  timeline,
  phase,
  elapsed,
  recording,
  rehearsing,
  onRehearse,
  onStopRehearse,
}: {
  timeline: Timeline;
  phase: ClockPhase;
  elapsed: number | null;
  recording: boolean;
  rehearsing: boolean;
  onRehearse: () => void;
  onStopRehearse: () => void;
}) {
  const t = elapsed ?? 0;
  const index = segmentIndexAt(timeline, t);
  const seg = timeline.segments[index];
  const next = timeline.segments[index + 1];

  return (
    <section
      aria-label="Chronologie du plan"
      className={cn('absolute inset-x-3 top-6 flex flex-col gap-1 text-paper', SHADOW)}
    >
      <div className="flex items-baseline justify-between font-mono text-label">
        <span>{phase === 'idle' ? 'Prêt' : mmss(t)}</span>
        <span>
          Passage {index + 1}/{timeline.segments.length} · {formatSeconds(timeline.duration_s)}
        </span>
      </div>
      <div aria-hidden className="flex h-1.5 gap-0.5">
        {timeline.segments.map((s, i) => (
          <div
            key={s.id}
            style={{ flexBasis: `${((s.end_s - s.start_s) / timeline.duration_s) * 100}%` }}
            className="relative bg-paper/30"
          >
            <div
              className={cn(
                'absolute inset-y-0 left-0',
                i === index && phase !== 'idle' ? 'bg-gold' : 'bg-paper/80',
              )}
              style={{
                width:
                  i < index || phase === 'finished'
                    ? '100%'
                    : i === index && phase === 'running'
                      ? `${Math.min(100, ((t - s.start_s) / (s.end_s - s.start_s)) * 100)}%`
                      : '0%',
              }}
            />
          </div>
        ))}
      </div>
      <p role="status" aria-live="polite" className="text-meta">
        {phase === 'idle'
          ? 'Le décompte démarre quand tu lances l’enregistrement. En attendant, place ton cadrage de départ.'
          : phase === 'finished'
            ? 'Plan terminé : arrête l’enregistrement.'
            : seg.description_fr}
      </p>
      {phase === 'idle' ? <p className="text-label text-paper/80">Début : {seg.description_fr}</p> : null}
      {phase === 'running' && next ? (
        <p className="text-label text-paper/80">
          Dans {Math.max(1, Math.ceil(seg.end_s - t))} s : {next.description_fr}
        </p>
      ) : null}
      {!recording ? (
        <div className="pointer-events-auto">
          {rehearsing && phase !== 'finished' ? (
            <Button variant="on-dark" size="sm" onClick={onStopRehearse}>
              Arrêter la répétition
            </Button>
          ) : (
            <Button variant="on-dark" size="sm" onClick={onRehearse}>
              {phase === 'finished' ? 'Répéter à nouveau' : 'Répéter sans enregistrer'}
            </Button>
          )}
        </div>
      ) : null}
    </section>
  );
}
