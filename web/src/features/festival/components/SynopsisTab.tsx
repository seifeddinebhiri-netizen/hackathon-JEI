import type { Project, SynopsisKind } from '@/api/types';
import { Button, CharCount, ErrorState, Field, Icon, StatusChip, TextArea } from '@/components/ui';
import { useFestivalSearch, useSynopsisFeedback } from '../hooks/useFestivals';
import { EMPTY_SYNOPSIS, useProjectField } from '../lib/localStore';

const VERSIONS: { kind: SynopsisKind; title: string; hint: string; rows: number; guide?: number }[] = [
  {
    kind: 'phrase',
    title: 'En une phrase',
    hint: 'Qui, ce qu’il veut, ce qui l’en empêche.',
    rows: 2,
    guide: 150,
  },
  {
    kind: 'court',
    title: 'Synopsis court',
    hint: 'Quelques lignes, pour les catalogues et les formulaires.',
    rows: 4,
  },
  {
    kind: 'long',
    title: 'Synopsis long',
    hint: 'L’histoire et ses enjeux, sans forcément révéler la fin.',
    rows: 9,
  },
];

function Coach({ kind, text, limit }: { kind: SynopsisKind; text: string; limit?: number }) {
  const fb = useSynopsisFeedback();
  return (
    <div className="flex flex-col gap-3">
      <Button
        variant="secondary"
        size="sm"
        icon="sparkle"
        loading={fb.isPending}
        onClick={() => fb.mutate({ kind, text, limit_chars: limit })}
        className="self-start"
      >
        Me poser des questions
      </Button>
      {fb.isError ? (
        <ErrorState
          title="Le coach n’a pas répondu"
          error={fb.error}
          onRetry={() => fb.mutate({ kind, text, limit_chars: limit })}
        />
      ) : null}
      {fb.data ? (
        <div className="border-2 border-ink bg-gold-soft p-4" aria-live="polite">
          <p className="eyebrow mb-2 flex items-center gap-1.5">
            <Icon name="sparkle" size={14} /> Questions du coach
          </p>
          <ul className="flex flex-col gap-2">
            {fb.data.questions.map((q) => (
              <li key={q} className="flex items-start gap-2">
                <span aria-hidden className="font-display font-bold">
                  ?
                </span>
                {q}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export function SynopsisTab({ project }: { project: Project }) {
  const [draft, setDraft, saveState] = useProjectField(project, 'synopsis', EMPTY_SYNOPSIS);
  const all = useFestivalSearch({}, project.festival_shortlist.length > 0);
  const ids = new Set(project.festival_shortlist.map((s) => s.festival_id));
  // Limites demandées par les festivals de la sélection
  const limits = (all.data ?? [])
    .filter((m) => ids.has(m.festival.id))
    .flatMap((m) =>
      m.festival.requirements
        .filter((r) => r.kind === 'synopsis' && r.limit_chars)
        .map((r) => ({ festival: m.festival.name, limit: r.limit_chars! })),
    )
    .sort((a, b) => a.limit - b.limit);
  const shortest = limits[0]?.limit;
  const longest = limits[limits.length - 1]?.limit;
  const limitFor = (k: SynopsisKind) => (k === 'court' ? shortest : k === 'long' ? longest : undefined);

  return (
    <div className="flex flex-col gap-6">
      <p className="flex items-start gap-2 border-2 border-ink bg-white p-4">
        <Icon name="edit" size={20} className="mt-0.5 shrink-0" />
        <span>
          <strong>Ton texte reste le tien.</strong> Le coach pose des questions pour t’aider à l’améliorer ;
          il ne réécrit jamais ton synopsis.
        </span>
      </p>

      {VERSIONS.map((v) => {
        const text = draft[v.kind];
        const limit = limitFor(v.kind);
        return (
          <section
            key={v.kind}
            aria-labelledby={`syn-${v.kind}`}
            className="grid grid-cols-1 gap-5 border-2 border-ink bg-white p-5 lg:grid-cols-12"
          >
            <div className="flex flex-col gap-3 lg:col-span-7">
              <h2 id={`syn-${v.kind}`} className="text-h3">
                {v.title}
              </h2>
              <Field label={v.title} hint={v.hint}>
                <TextArea
                  rows={v.rows}
                  value={text}
                  onChange={(e) => setDraft((d) => ({ ...d, [v.kind]: e.target.value }))}
                />
              </Field>
              <CharCount value={text} limit={limit ?? v.guide} />
              {(v.kind === 'court' || v.kind === 'long') && limits.length ? (
                <ul className="flex flex-wrap gap-2" aria-label="Limites des festivals sélectionnés">
                  {limits.map((l) => {
                    const ok = text.length <= l.limit;
                    return (
                      <li key={`${l.festival}-${l.limit}`}>
                        <StatusChip
                          tone={!text ? 'neutral' : ok ? 'ok' : 'bad'}
                          icon={!text ? null : ok ? 'check' : 'x'}
                        >
                          {l.festival.replace(/\s*:.*$/, '')} · {l.limit} car.
                        </StatusChip>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
              {(v.kind === 'court' || v.kind === 'long') && !limits.length ? (
                <p className="text-meta text-muted-on-light">
                  Ajoute des festivals à ta sélection pour voir leurs limites.
                </p>
              ) : null}
            </div>
            <div className="lg:col-span-5">
              <Coach kind={v.kind} text={text} limit={limit ?? v.guide} />
            </div>
          </section>
        );
      })}
      <p role="status" className="text-meta text-muted-on-light">
        {saveState === 'saving' || saveState === 'pending'
          ? 'Enregistrement…'
          : saveState === 'error'
            ? 'Échec de l’enregistrement : une copie reste dans ce navigateur.'
            : saveState === 'saved'
              ? 'Enregistré dans ton projet.'
              : 'Enregistré automatiquement dans ton projet.'}
      </p>
    </div>
  );
}
