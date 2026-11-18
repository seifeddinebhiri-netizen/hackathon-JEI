import type { CalibrationField, ShotChoices, Timeline } from '@/api/types';
import { Button, Select, TextArea } from '@/components/ui';
import { cn } from '@/lib/cn';
import { describeTargets } from '../format';
import {
  changedFields,
  describeChoices,
  formatSeconds,
  MAX_SEGMENTS,
  removeSegment,
  setBoundary,
  setChoice,
  setDescription,
  setEndEnabled,
  splitSegment,
} from '../timeline';

function Rows({ title, rows }: { title: string; rows: { label: string; value: string }[] }) {
  return (
    <div>
      <p className="eyebrow text-muted-on-light">{title}</p>
      <dl className="mt-1 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-meta">
        {rows.map((r) => (
          <div key={r.label} className="contents">
            <dt className="text-muted-on-light">{r.label}</dt>
            <dd className="text-right font-mono">{r.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** La chronologie en barre : un bloc par passage, sa largeur proportionnelle à sa durée. */
export function TimelineBar({ timeline }: { timeline: Timeline }) {
  return (
    <div aria-hidden className="flex h-8 border-2 border-ink text-label">
      {timeline.segments.map((s, i) => (
        <div
          key={s.id}
          style={{ flexBasis: `${((s.end_s - s.start_s) / timeline.duration_s) * 100}%` }}
          className={cn(
            'flex min-w-0 items-center justify-center truncate border-l border-ink first:border-l-0',
            i % 2 ? 'bg-gold-soft' : 'bg-gold',
          )}
        >
          {formatSeconds(s.start_s).replace(' s', '')}–{formatSeconds(s.end_s)}
        </div>
      ))}
    </div>
  );
}

/**
 * Les passages d'un plan en mouvement, en mots : ce qui se passe, de quelle seconde à quelle seconde,
 * et le cadrage au début (et à la fin si ça évolue). Tout se modifie ; les chiffres suivent.
 */
export function TimelineEditor({
  shotId,
  timeline,
  resolved,
  vocabulary,
  onChange,
}: {
  shotId: string;
  /** La chronologie en cours de modification (celle de l'IA, ou la version de l'utilisateur). */
  timeline: Timeline;
  /** La même, avec ses chiffres à jour (null : calibration absente, pas de chiffres inventés). */
  resolved: Timeline | null;
  vocabulary: CalibrationField[];
  onChange: (next: Timeline) => void;
}) {
  const tl = timeline;
  return (
    <ol aria-label="Passages de la prise" className="flex flex-col gap-4">
      {tl.segments.map((seg, i) => {
        const last = i === tl.segments.length - 1;
        const next = tl.segments[i + 1];
        const changed = changedFields(seg);
        const nums = resolved?.segments[i];
        const apply = (n: Timeline | null) => n && onChange(n);
        return (
          <li
            key={seg.id}
            aria-label={`Passage ${i + 1}`}
            className="flex flex-col gap-3 border-2 border-line-light p-4"
          >
            <p className="font-display text-h3 font-bold">
              Passage {i + 1} · de {formatSeconds(seg.start_s).replace(' s', '')} à {formatSeconds(seg.end_s)}
            </p>

            <label className="flex flex-col gap-1.5 text-meta font-semibold" htmlFor={`${seg.id}-desc`}>
              Ce qui se passe
              <TextArea
                id={`${seg.id}-desc`}
                rows={2}
                value={seg.description_fr}
                onChange={(e) => apply(setDescription(tl, i, e.target.value))}
              />
            </label>

            {!last ? (
              <label className="flex flex-col text-meta font-semibold" htmlFor={`${seg.id}-end`}>
                Ce passage finit à {formatSeconds(seg.end_s)}
                <input
                  id={`${seg.id}-end`}
                  type="range"
                  min={seg.start_s + 0.5}
                  max={next.end_s - 0.5}
                  step={0.5}
                  value={seg.end_s}
                  onChange={(e) => apply(setBoundary(tl, i, Number(e.target.value)))}
                  className="h-11 w-full accent-action"
                />
              </label>
            ) : null}

            <p className="text-meta">
              <span className="font-semibold">Cadrage au début : </span>
              {describeChoices(seg.at_start, vocabulary).join(' · ')}
              {seg.at_end && changed.size > 0 ? (
                <>
                  <br />
                  <span className="font-semibold">Puis, à la fin : </span>
                  {describeChoices(seg.at_end, vocabulary, changed).join(' · ')}
                </>
              ) : null}
            </p>

            <details className="border-t border-line-light pt-2">
              <summary className="min-h-11 cursor-pointer font-semibold">
                Modifier le cadrage de ce passage
              </summary>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                {vocabulary.map((f) => (
                  <label
                    key={f.key}
                    htmlFor={`${seg.id}-start-${f.key}`}
                    className="flex flex-col gap-1.5 text-meta font-semibold"
                  >
                    {f.label_fr}
                    <Select
                      id={`${seg.id}-start-${f.key}`}
                      value={seg.at_start[f.key]}
                      onChange={(e) =>
                        apply(setChoice(tl, i, 'start', f.key, e.target.value as ShotChoices[typeof f.key]))
                      }
                    >
                      {f.options.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label_fr}
                        </option>
                      ))}
                    </Select>
                  </label>
                ))}
              </div>

              <label className="mt-3 flex min-h-11 items-center gap-3 text-meta font-semibold">
                <input
                  type="checkbox"
                  className="size-6 accent-action"
                  checked={seg.at_end !== null}
                  onChange={(e) => apply(setEndEnabled(tl, i, e.target.checked))}
                />
                Le cadrage évolue pendant ce passage
              </label>
              {seg.at_end ? (
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  {vocabulary.map((f) => (
                    <label
                      key={f.key}
                      htmlFor={`${seg.id}-end-${f.key}`}
                      className="flex flex-col gap-1.5 text-meta font-semibold"
                    >
                      À la fin : {f.label_fr.toLowerCase()}
                      <Select
                        id={`${seg.id}-end-${f.key}`}
                        value={seg.at_end![f.key]}
                        onChange={(e) =>
                          apply(setChoice(tl, i, 'end', f.key, e.target.value as ShotChoices[typeof f.key]))
                        }
                      >
                        {f.options.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label_fr}
                          </option>
                        ))}
                      </Select>
                    </label>
                  ))}
                </div>
              ) : null}
            </details>

            <details className="border-t border-line-light pt-2">
              <summary className="min-h-11 cursor-pointer font-semibold">Chiffres de ce passage</summary>
              {nums ? (
                <div className="mt-2 flex flex-col gap-3">
                  <Rows title="Au début" rows={describeTargets(nums.targets_start)} />
                  {nums.targets_end ? (
                    <Rows
                      title="À la fin (les valeurs glissent peu à peu)"
                      rows={describeTargets(nums.targets_end)}
                    />
                  ) : null}
                </div>
              ) : (
                <p role="status" className="mt-2 text-meta font-semibold text-warn-fg">
                  Les chiffres de tes modifications se calculent avec les tables de calibration, pas encore
                  chargées. Connecte-toi à internet une fois.
                </p>
              )}
            </details>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="ghost"
                size="sm"
                disabled={tl.segments.length >= MAX_SEGMENTS || splitSegment(tl, i) === null}
                onClick={() => apply(splitSegment(tl, i))}
              >
                Couper ce passage en deux
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={tl.segments.length <= 1}
                onClick={() => apply(removeSegment(tl, i))}
              >
                Supprimer ce passage
              </Button>
            </div>
            <span className="sr-only">{shotId}</span>
          </li>
        );
      })}
    </ol>
  );
}
