import { useState } from 'react';
import type { QuickSlot, QuickSlotsResponse } from '@/api/types';
import { Button, EmptyState, Icon, StatusChip } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatDayLong, formatTime, toDate } from '@/lib/format';
import { VERDICT_ICONS, VERDICT_LABELS, VERDICT_TONES } from '../lib/labels';
import { SunDiagram } from './SunDiagram';
import { SunTimes, WeatherSummary } from './Tags';

export function QuickResults({
  result,
  onAdd,
  adding,
  addedSlot,
}: {
  result: QuickSlotsResponse;
  onAdd?: (slot: QuickSlot) => void;
  adding?: boolean;
  addedSlot?: string;
}) {
  const [selected, setSelected] = useState(0);
  if (!result.slots.length) {
    return (
      <EmptyState icon="calendar" title="Aucun créneau sur cette période">
        Élargis la période ou change le moment voulu.
      </EmptyState>
    );
  }
  const current = result.slots[Math.min(selected, result.slots.length - 1)];

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
      <ol className="flex flex-col gap-3 xl:col-span-7" aria-label="Créneaux classés">
        {result.slots.map((s, i) => {
          const active = i === selected;
          return (
            <li key={s.start}>
              <div
                className={cn(
                  'border-2 bg-white transition-shadow',
                  active ? 'border-ink shadow-hard' : 'border-line-light hover:border-ink',
                )}
              >
                <button
                  type="button"
                  onClick={() => setSelected(i)}
                  aria-pressed={active}
                  className="flex w-full flex-col gap-2 p-4 text-left"
                >
                  <span className="flex flex-wrap items-center justify-between gap-2">
                    <span className="flex items-center gap-3">
                      <span className="font-mono text-label text-muted-on-light">#{i + 1}</span>
                      <span className="font-display text-[20px] font-bold first-letter:uppercase">
                        {formatDayLong(s.start)}
                      </span>
                    </span>
                    <StatusChip tone={VERDICT_TONES[s.verdict]} icon={VERDICT_ICONS[s.verdict]}>
                      {VERDICT_LABELS[s.verdict]}
                    </StatusChip>
                  </span>
                  <span className="flex items-center gap-1.5 font-semibold">
                    <Icon name="clock" size={16} /> {formatTime(s.start)} → {formatTime(s.end)}
                  </span>
                  <span className="text-meta text-muted-on-light">{s.reason}</span>
                  <span className="flex flex-wrap gap-x-6 gap-y-1">
                    <WeatherSummary weather={s.weather} />
                  </span>
                </button>
              </div>
            </li>
          );
        })}
      </ol>

      <aside className="xl:col-span-5" aria-label="Détail du créneau choisi">
        <div className="sticky top-24 flex flex-col gap-4 border-2 border-ink bg-white p-5">
          <p className="eyebrow text-muted-on-light">Créneau #{selected + 1}</p>
          <p className="font-display text-h3 font-bold first-letter:uppercase">
            {formatDayLong(current.start)}
          </p>
          <SunDiagram at={toDate(current.start)} lat={result.place.lat} lon={result.place.lon} />
          <SunTimes weather={current.weather} />
          <p className="flex items-center gap-1.5 text-meta">
            <Icon name="pin" size={16} /> {result.place.label}
          </p>
          {onAdd ? (
            <div className="flex flex-col gap-2 border-t-2 border-line-light pt-4">
              <Button
                variant="secondary"
                icon={addedSlot === current.start ? 'check' : 'plus'}
                loading={adding}
                disabled={addedSlot === current.start}
                onClick={() => onAdd(current)}
              >
                {addedSlot === current.start ? 'Ajoutée à ton film' : 'Ajouter à mon film'}
              </Button>
              <p className="text-meta text-muted-on-light">
                La scène est ajoutée à ton film, sans être placée dans le planning.
              </p>
            </div>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
