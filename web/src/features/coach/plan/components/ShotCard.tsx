import type {
  Calibration,
  CalibrationField,
  PlanShot,
  ShotChoices,
  ShotTargets,
  Timeline,
} from '@/api/types';
import { AiDraftBadge, Button, Icon, Select, TextArea } from '@/components/ui';
import { cn } from '@/lib/cn';
import { describeTargets } from '../format';
import { resolveShot, resolveTimeline } from '../resolve';
import { NOTE_MAX } from '../store';
import { describeSegment } from '../timeline';
import { TimelineBar, TimelineEditor } from './TimelineEditor';

/**
 * LE plan proposé par l'IA pour la scène, en mots. Plan fixe : un cadrage. Plan en mouvement : une
 * chronologie de passages en secondes. L'utilisateur peut tout modifier ; les chiffres suivent.
 */
export function ShotCard({
  index,
  total,
  shot,
  overrides,
  timelineEdit,
  calibration,
  specCalibration,
  vocabulary,
  note,
  busy,
  onNote,
  onChange,
  onResetField,
  onResetAll,
  onTimelineChange,
  onFilm,
}: {
  index: number;
  /** Nombre de plans de la scène : un seul aujourd'hui (plus pour d'anciennes scènes enregistrées). */
  total: number;
  shot: PlanShot;
  overrides: Partial<ShotChoices> | undefined;
  /** Chronologie modifiée par l'utilisateur (plan en mouvement). */
  timelineEdit: Timeline | undefined;
  calibration: Calibration | undefined;
  specCalibration: string;
  vocabulary: CalibrationField[];
  /** Notes de l'utilisateur sur un plan en mouvement. */
  note: string;
  busy?: boolean;
  onNote: (text: string) => void;
  onChange: <K extends keyof ShotChoices>(key: K, value: ShotChoices[K]) => void;
  onResetField: (key: keyof ShotChoices) => void;
  onResetAll: () => void;
  /** null : revenir à la chronologie proposée par l'IA. */
  onTimelineChange: (next: Timeline | null) => void;
  onFilm: (targets: ShotTargets, label: string, note: string, timeline?: Timeline) => void;
}) {
  const letter = 'ABCD'[index] ?? String(index + 1);
  const name = total > 1 ? `Plan ${letter}` : 'Plan';
  const isTimeline = !!shot.timeline;

  const resolved = resolveShot(shot, overrides, calibration, specCalibration);
  const resolvedTimeline = resolveTimeline(shot, timelineEdit, calibration, specCalibration);
  const editedAny = isTimeline ? !!resolvedTimeline?.edited : resolved.edited.length > 0;
  const rows = resolved.targets ? describeTargets(resolved.targets) : [];
  // Seul le cadrage d'un plan fixe se modifie ici ; le mouvement se règle avec la chronologie.
  const staticFields = vocabulary.filter((f) => f.key !== 'movement');

  const firstTargets = isTimeline
    ? (resolvedTimeline?.timeline?.segments[0].targets_start ?? null)
    : resolved.targets;

  return (
    <article
      aria-label={name}
      className="flex flex-col gap-4 border-2 border-ink bg-white p-5 shadow-hard-sm"
    >
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <p className="eyebrow text-muted-on-light">{isTimeline ? 'Plan en mouvement' : 'Plan fixe'}</p>
          <AiDraftBadge />
          {editedAny ? (
            <span className="eyebrow inline-flex items-center gap-1.5 border border-ink bg-gold px-2 py-1 text-ink">
              <Icon name="edit" size={14} />
              Modifié par toi
            </span>
          ) : null}
        </div>
        <h3 className="font-display text-h3 leading-tight font-bold">{shot.intent.label_fr}</h3>
        <p>{shot.intent.why_fr}</p>
      </header>

      {isTimeline && shot.timeline ? (
        <>
          <section
            aria-label="Comment ce plan sera filmé"
            className="flex flex-col gap-3 border-2 border-ink bg-gold-soft p-4"
          >
            <p className="font-semibold">Comment ce plan sera filmé</p>
            <p>{shot.timeline.how_fr}</p>
            <TimelineBar timeline={timelineEdit ?? shot.timeline} />
            <ol aria-label="Résumé de la prise" className="flex flex-col gap-1 text-meta">
              {(resolvedTimeline?.timeline ?? timelineEdit ?? shot.timeline).segments.map((s) => (
                <li key={s.id}>{describeSegment(s, vocabulary)}</li>
              ))}
            </ol>
            <p className="text-label text-muted-on-light">
              Les secondes se comptent depuis le début de la prise : le décompte démarre quand tu lances
              l’enregistrement (ou une répétition).
            </p>
          </section>

          <details open className="border-t-2 border-line-light pt-3">
            <summary className="min-h-11 cursor-pointer font-semibold">
              Modifier la chronologie, en mots
            </summary>
            <div className="mt-3 flex flex-col gap-3">
              <TimelineEditor
                shotId={shot.id}
                timeline={timelineEdit ?? shot.timeline}
                resolved={resolvedTimeline?.timeline ?? null}
                vocabulary={vocabulary}
                onChange={onTimelineChange}
              />
              {editedAny ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="self-start"
                  onClick={() => onTimelineChange(null)}
                >
                  Tout remettre comme l’IA l’a proposé
                </Button>
              ) : null}
            </div>
          </details>

          <div className="flex flex-col gap-1.5 border-t-2 border-line-light pt-3">
            <label htmlFor={`${shot.id}-note`} className="text-meta font-semibold">
              Tes notes sur ce mouvement <span className="font-normal text-muted-on-light">(facultatif)</span>
            </label>
            <TextArea
              id={`${shot.id}-note`}
              rows={2}
              maxLength={NOTE_MAX}
              value={note}
              onChange={(e) => onNote(e.target.value)}
              placeholder="Ex. : départ à la porte du café, je garde une vitesse régulière"
            />
          </div>
        </>
      ) : null}

      {shot.intent.advice_fr.length > 0 ? (
        <ul className="list-disc pl-5 text-meta text-muted-on-light">
          {shot.intent.advice_fr.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      ) : null}

      {shot.rules.length > 0 ? (
        <details className="border-t-2 border-line-light pt-3">
          <summary className="min-h-11 cursor-pointer font-semibold">
            Pourquoi ? Les règles et leurs sources
          </summary>
          <ul className="mt-2 flex flex-col gap-3 text-meta">
            {shot.rules.map((r) => (
              <li key={r.id}>
                <p className="font-semibold">
                  {r.title_fr}{' '}
                  <span className="font-normal text-muted-on-light">· confiance {r.confidence}</span>
                </p>
                <ul className="mt-1 list-disc pl-5">
                  {r.sources.map((s) => (
                    <li key={s.url}>
                      <a
                        className="underline underline-offset-2"
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {s.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {!isTimeline ? (
        <>
          <details open className="border-t-2 border-line-light pt-3">
            <summary className="min-h-11 cursor-pointer font-semibold">Modifier le plan, en mots</summary>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              {staticFields.map((f) => {
                const edited = resolved.edited.includes(f.key);
                return (
                  <div key={f.key} className="flex flex-col gap-1.5">
                    <label
                      htmlFor={`${shot.id}-${f.key}`}
                      className={cn('text-meta font-semibold', edited && 'text-ink')}
                    >
                      {f.label_fr}
                      {edited ? <span className="font-normal text-muted-on-light"> (modifié)</span> : null}
                    </label>
                    <Select
                      id={`${shot.id}-${f.key}`}
                      value={resolved.intent[f.key]}
                      onChange={(e) => onChange(f.key, e.target.value as never)}
                      className={edited ? 'border-gold bg-gold-soft' : undefined}
                    >
                      {f.options.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label_fr}
                          {o.value === shot.intent[f.key] ? ' (proposé par l’IA)' : ''}
                        </option>
                      ))}
                    </Select>
                    {edited ? (
                      <button
                        type="button"
                        className="min-h-11 self-start text-meta underline underline-offset-2"
                        onClick={() => onResetField(f.key)}
                      >
                        Revenir à la proposition de l’IA
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
            {resolved.edited.length > 0 ? (
              <Button variant="ghost" size="sm" className="mt-2" onClick={onResetAll}>
                Tout remettre comme l’IA l’a proposé
              </Button>
            ) : null}
          </details>

          <details className="border-t-2 border-line-light pt-3">
            <summary className="min-h-11 cursor-pointer font-semibold">
              Ce que le téléphone va vérifier (les chiffres)
            </summary>
            {resolved.targets ? (
              <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-meta">
                {rows.map((r) => (
                  <div key={r.label} className="contents">
                    <dt className="text-muted-on-light">{r.label}</dt>
                    <dd className="text-right font-mono">{r.value}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p role="status" className="mt-2 text-meta font-semibold text-warn-fg">
                Les chiffres de tes modifications se calculent avec les tables de calibration, pas encore
                chargées. Connecte-toi à internet une fois.
              </p>
            )}
            <p className="mt-2 text-label text-muted-on-light">
              Seuils de départ (calibration {specCalibration}), à ajuster après des essais de tournage.
            </p>
          </details>
        </>
      ) : (
        <p className="text-label text-muted-on-light">
          Seuils de départ (calibration {specCalibration}), à ajuster après des essais de tournage.
        </p>
      )}

      <Button
        size="lg"
        icon="eye"
        className="self-start"
        disabled={!firstTargets || busy}
        onClick={() =>
          firstTargets &&
          onFilm(
            firstTargets,
            shot.intent.label_fr,
            isTimeline ? note.trim() : '',
            resolvedTimeline?.timeline ?? undefined,
          )
        }
      >
        Filmer ce plan
      </Button>
    </article>
  );
}
