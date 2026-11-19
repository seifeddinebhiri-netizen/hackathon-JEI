import type { SubtitleLine } from '@/api/types';
import { cn } from '@/lib/cn';
import { needsCheck, segmentState, type SegmentState, type ViewerFilter } from '../../lib/viewer';

const SEGMENT: Record<SegmentState, string> = {
  en_cours: 'bg-gold border-ink',
  validee: 'bg-ok-fg border-ok-fg',
  a_verifier: 'bg-line-light border-line-light hover:border-ink',
};
const STATE_LABEL: Record<SegmentState, string> = {
  en_cours: 'en cours',
  validee: 'validée',
  a_verifier: 'à vérifier',
};

/** Frise : un segment par ligne, dans l'ordre du film ; clic = aller à la ligne. */
export function Timeline({
  lines,
  visible,
  current,
  validated,
  filter,
  riskyCount,
  onFilter,
  onSelect,
}: {
  lines: SubtitleLine[];
  /** Index des lignes montrées par le filtre. */
  visible: number[];
  current: number;
  validated: ReadonlySet<string>;
  filter: ViewerFilter;
  riskyCount: number;
  onFilter: (f: ViewerFilter) => void;
  onSelect: (index: number) => void;
}) {
  return (
    <section aria-labelledby="frise-titre" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="frise-titre" className="text-h3">
          Frise des lignes
        </h2>
        <div role="group" aria-label="Lignes montrées" className="flex border-2 border-ink">
          {(
            [
              ['risque', `À vérifier d’abord (${riskyCount})`],
              ['toutes', `Toutes (${lines.length})`],
            ] as const
          ).map(([v, label], i) => (
            <button
              key={v}
              type="button"
              aria-pressed={filter === v}
              onClick={() => onFilter(v)}
              className={cn(
                'min-h-11 px-3 text-meta font-semibold md:px-4',
                i > 0 && 'border-l-2 border-ink',
                filter === v ? 'bg-ink text-paper' : 'bg-white text-ink hover:bg-gold-soft',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {visible.length ? (
        <ol aria-label="Lignes de sous-titres" className="flex gap-1 overflow-x-auto pb-1">
          {visible.map((i) => {
            const line = lines[i];
            const state = segmentState(line, i, current, validated);
            const risky = needsCheck(line, validated);
            return (
              <li key={line.id} className="min-w-10 flex-1">
                <button
                  type="button"
                  onClick={() => onSelect(i)}
                  aria-current={i === current ? 'true' : undefined}
                  aria-label={`Ligne ${i + 1} · ${line.start} · ${STATE_LABEL[state]}${risky ? ' · à risque' : ''}`}
                  className={cn('relative block h-11 w-full border-2', SEGMENT[state])}
                >
                  {risky ? <span aria-hidden className="absolute top-0 right-0 size-2.5 bg-action" /> : null}
                  <span aria-hidden className="font-mono text-label text-ink/70">
                    {state === 'validee' ? '' : i + 1}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="border-2 border-dashed border-line-light bg-white p-4 text-meta">
          Plus aucune ligne à risque à vérifier. Passe sur « Toutes » pour tout relire.
        </p>
      )}

      <ul className="flex flex-wrap gap-x-5 gap-y-2 text-meta text-muted-on-light">
        <li className="flex items-center gap-2">
          <span className="size-3 border-2 border-line-light bg-line-light" aria-hidden />À vérifier
        </li>
        <li className="flex items-center gap-2">
          <span className="size-3 bg-ok-fg" aria-hidden />
          Validée
        </li>
        <li className="flex items-center gap-2">
          <span className="size-3 border-2 border-ink bg-gold" aria-hidden />
          En cours
        </li>
        <li className="flex items-center gap-2">
          <span className="size-2.5 bg-action" aria-hidden />
          Ligne à risque
        </li>
      </ul>
    </section>
  );
}
