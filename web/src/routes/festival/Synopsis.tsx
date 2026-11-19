import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { synopsisFeedbackAvailable } from '@/api';
import type { Festival, Project, SynopsisKind } from '@/api/types';
import {
  AiDraftBadge,
  Button,
  ErrorState,
  Icon,
  LoadingBlock,
  QueryState,
  StatusChip,
  TextArea,
} from '@/components/ui';
import { Breadcrumb, WithProject } from '@/features/festival/components/Kit';
import { shortName } from '@/features/festival/lib/kit';
import {
  useShortlistFestivals,
  useSynopsisFeedback,
  useTranslateSynopsis,
} from '@/features/festival/hooks/useFestivals';
import { synopsisLimit } from '@/features/festival/lib/dossier';
import { useSynopsisEnglish } from '@/features/festival/hooks/useKit';
import { EMPTY_SYNOPSIS, useProjectField } from '@/features/festival/lib/localStore';
import { cn } from '@/lib/cn';

const VERSIONS: { value: SynopsisKind; label: string; hint: string }[] = [
  { value: 'phrase', label: 'En une phrase', hint: 'Qui, ce qu’il veut, ce qui l’en empêche.' },
  {
    value: 'court',
    label: 'Synopsis court',
    hint: 'Quelques lignes, pour les catalogues et les formulaires.',
  },
  { value: 'long', label: 'Synopsis long', hint: 'Une page, pour les dossiers de presse.' },
];

function EnglishVersion({
  project,
  kind,
  text,
  festivals,
}: {
  project: Project;
  kind: SynopsisKind;
  text: string;
  festivals: Festival[];
}) {
  const translate = useTranslateSynopsis();
  // Enregistrée dans la base (film_kits.synopsis_en), pas dans le navigateur.
  const [draft, set, saveState] = useSynopsisEnglish(project.id, kind);
  const [editing, setEditing] = useState(false);
  const stale = !!draft && draft.source !== text.trim();
  const forWho = festivals.filter((f) => f.subtitle_langs.includes('en')).map(shortName);
  const run = () =>
    translate.mutate(
      { kind, text: text.trim(), target_lang: 'en' },
      { onSuccess: (r) => set({ text: r.text, source: text.trim(), validated: false }) },
    );

  return (
    <section
      aria-labelledby="en-titre"
      className="flex flex-col gap-3 border-2 border-dashed border-ink bg-white p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="en-titre" className="text-h3">
          Version anglaise
        </h2>
        {draft ? <AiDraftBadge validated={draft.validated && !stale} /> : null}
      </div>
      <p className="text-meta text-muted-on-light">
        Traduction de <strong>ton</strong> texte{forWho.length ? `, pour ${forWho.join(' et ')}` : ''}. Rien
        n’est ajouté ni réécrit.
      </p>
      {translate.isError ? (
        <ErrorState title="Traduction impossible" error={translate.error} onRetry={run} />
      ) : null}
      {draft ? (
        editing ? (
          <TextArea
            lang="en"
            rows={5}
            aria-label="Version anglaise"
            value={draft.text}
            onChange={(e) => set({ ...draft, text: e.target.value, validated: false })}
          />
        ) : (
          <p lang="en" className="bg-paper p-3">
            {draft.text}
          </p>
        )
      ) : (
        <p className="text-meta text-muted-on-light">
          {text.trim() ? 'Pas encore traduit.' : 'Pas encore de texte à traduire.'}
        </p>
      )}
      {stale ? (
        <p className="flex items-center gap-2 text-meta font-semibold text-warn-fg">
          <Icon name="alert" size={14} /> Ton texte a changé depuis cette traduction.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {draft && !stale ? (
          <Button
            size="sm"
            variant={draft.validated ? 'secondary' : 'primary'}
            icon={draft.validated ? undefined : 'check'}
            onClick={() => set({ ...draft, validated: !draft.validated })}
          >
            {draft.validated ? 'Annuler la validation' : 'Valider la traduction'}
          </Button>
        ) : null}
        {draft ? (
          <Button
            size="sm"
            variant="secondary"
            icon="edit"
            onClick={() => setEditing((e) => !e)}
            aria-pressed={editing}
          >
            {editing ? 'Terminer' : 'Modifier'}
          </Button>
        ) : null}
        <Button
          className="whitespace-normal! text-left"
          size="sm"
          variant="secondary"
          onClick={run}
          loading={translate.isPending}
          disabled={!text.trim()}
        >
          {draft ? 'Retraduire après mes changements' : 'Traduire en anglais'}
        </Button>
      </div>
      {saveState === 'error' ? (
        <p role="alert" className="flex items-center gap-2 text-meta font-semibold text-bad-fg">
          <Icon name="alert" size={14} /> La version anglaise n’a pas été enregistrée. Modifie-la pour
          réessayer.
        </p>
      ) : null}
    </section>
  );
}

function Limits({ kind, count, festivals }: { kind: SynopsisKind; count: number; festivals: Festival[] }) {
  const rows = festivals.map((f) => ({ f, ...synopsisLimit(f, kind) }));
  const anyExample = rows.some((r) => r.example);
  return (
    <section aria-labelledby="limites" className="flex flex-col gap-3 border-2 border-ink bg-white p-5">
      <h2 id="limites" className="text-h3">
        Limites de tes festivals
      </h2>
      <p className="text-meta text-muted-on-light">
        Vérifiées par le code à chaque frappe.
        {anyExample ? ' Les limites marquées « exemple » sont des données d’exemple, pas le règlement.' : ''}
      </p>
      {rows.length ? (
        <ul className="flex flex-col" aria-live="polite">
          {rows.map(({ f, limit, example, requested }) => {
            const over = limit !== null && count > limit;
            return (
              <li
                key={f.id}
                className="flex items-start gap-3 border-b border-line-light py-2 last:border-b-0"
              >
                <span
                  className={cn(
                    'grid size-7 shrink-0 place-items-center border-2',
                    over ? 'border-bad-fg bg-bad-bg text-bad-fg' : 'border-ok-fg bg-ok-bg text-ok-fg',
                  )}
                >
                  <Icon name={over ? 'x' : 'check'} size={16} />
                  <span className="sr-only">{over ? 'Trop long : ' : 'Ça passe : '}</span>
                </span>
                <span className="flex flex-1 flex-col">
                  <span className="flex flex-wrap items-center gap-2">
                    <strong>{shortName(f)}</strong>
                    {example ? (
                      <StatusChip tone="neutral" icon="info">
                        Exemple
                      </StatusChip>
                    ) : null}
                  </span>
                  <span className="text-meta text-muted-on-light">
                    {limit === null
                      ? requested
                        ? 'Demandé, sans limite précise.'
                        : 'Pas demandé ou pas de limite.'
                      : over
                        ? `${count} / ${limit} : retire ${count - limit} caractères.`
                        : `${count} / ${limit} : ça passe.`}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-meta text-muted-on-light">
          Ajoute des festivals à « Mes dossiers » pour voir leurs limites.
        </p>
      )}
    </section>
  );
}

function Coach({ kind, text, limit }: { kind: SynopsisKind; text: string; limit?: number }) {
  const feedback = useSynopsisFeedback();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const { mutate } = feedback;
  const ask = () => {
    setDismissed(new Set());
    mutate({ kind, text: text.trim(), limit_chars: limit });
  };
  // Premières questions à l'ouverture de chaque version (le composant est recréé à chaque version)
  const first = useRef({ kind, text, limit });
  useEffect(() => {
    const f = first.current;
    mutate({ kind: f.kind, text: f.text.trim(), limit_chars: f.limit });
  }, [mutate]);
  const questions = (feedback.data?.questions ?? []).filter((q) => !dismissed.has(q));
  return (
    <section aria-labelledby="coach" className="flex flex-col gap-3 border-2 border-line-light bg-white p-5">
      <p id="coach" className="eyebrow">
        Les questions du coach
      </p>
      <p className="text-meta text-muted-on-light">Pour t’aider à relire. Tu peux les ignorer.</p>
      {feedback.isPending ? (
        <LoadingBlock lines={2} label="Le coach lit ton texte…" />
      ) : feedback.isError ? (
        <ErrorState title="Le coach ne répond pas" error={feedback.error} onRetry={ask} />
      ) : questions.length ? (
        <ol className="flex flex-col gap-3">
          {questions.map((q) => (
            <li key={q} className="flex flex-col gap-2 border-l-4 border-gold pl-3">
              <p>{q}</p>
              <Button
                size="sm"
                variant="ghost"
                className="self-start"
                onClick={() => setDismissed((d) => new Set(d).add(q))}
              >
                C’est voulu, j’ignore
              </Button>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-meta">Plus de questions. Ton texte est prêt à relire une dernière fois.</p>
      )}
      <Button variant="secondary" size="sm" className="self-start" onClick={ask} loading={feedback.isPending}>
        Me reposer des questions
      </Button>
    </section>
  );
}

function Page({ project }: { project: Project }) {
  const [params, setParams] = useSearchParams();
  const raw = params.get('version');
  const kind: SynopsisKind = raw === 'phrase' || raw === 'long' ? raw : 'court';
  const [synopsis, setSynopsis, saveState] = useProjectField(project, 'synopsis', EMPTY_SYNOPSIS);
  const ids = project.festival_shortlist.map((s) => s.festival_id);
  const festivals = useShortlistFestivals(ids);
  const version = VERSIONS.find((v) => v.value === kind)!;
  const text = synopsis[kind];
  const list = useMemo(() => festivals.data?.festivals ?? [], [festivals.data]);
  const minLimit = useMemo(() => {
    const ls = list.map((f) => synopsisLimit(f, kind).limit).filter((n): n is number => n !== null);
    return ls.length ? Math.min(...ls) : undefined;
  }, [list, kind]);

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb items={[{ label: 'Mes dossiers', to: '/festival/dossiers' }, { label: 'Synopsis' }]} />
      <h1 className="text-[36px] leading-none md:text-page">Synopsis de {project.title}</h1>
      <p className="flex max-w-3xl items-start gap-2 border-l-4 border-gold bg-white p-3">
        <Icon name="shield" size={18} className="mt-1 shrink-0" />
        <span>
          <strong>Ton texte reste le tien.</strong> L’IA pose des questions et vérifie les limites. Elle
          n’écrit jamais ton synopsis à ta place.
        </span>
      </p>
      <div role="group" aria-label="Version" className="flex w-fit flex-wrap border-2 border-ink">
        {VERSIONS.map((v, i) => (
          <button
            key={v.value}
            type="button"
            aria-pressed={kind === v.value}
            onClick={() => setParams((p) => (p.set('version', v.value), p), { replace: true })}
            className={cn(
              'min-h-11 px-4 text-meta font-semibold',
              i > 0 && 'border-l-2 border-ink',
              kind === v.value ? 'bg-ink text-paper' : 'bg-white text-ink hover:bg-gold-soft',
            )}
          >
            {v.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-start">
        <div className="flex flex-col gap-6 lg:col-span-7">
          <div className="flex flex-col gap-2">
            <label htmlFor="synopsis" className="font-display text-h3 font-bold">
              {version.label}
            </label>
            <p id="synopsis-aide" className="text-meta text-muted-on-light">
              {version.hint}
            </p>
            <TextArea
              id="synopsis"
              rows={kind === 'long' ? 14 : 7}
              aria-describedby="synopsis-aide synopsis-compte"
              value={text}
              onChange={(e) => setSynopsis((s) => ({ ...s, [kind]: e.target.value }))}
            />
            <div className="flex flex-wrap justify-between gap-2">
              <p id="synopsis-compte" className="eyebrow text-muted-on-light" aria-live="polite">
                {text.length} caractères
              </p>
              <p role="status" className="text-meta text-muted-on-light">
                {saveState === 'saving' || saveState === 'pending'
                  ? 'Enregistrement…'
                  : saveState === 'error'
                    ? 'Échec de l’enregistrement : vérifie ta connexion, le texte sera renvoyé à la prochaine modification.'
                    : 'Enregistré dans ton projet.'}
              </p>
            </div>
          </div>
          <EnglishVersion key={kind} project={project} kind={kind} text={text} festivals={list} />
        </div>
        <aside className="flex flex-col gap-6 lg:col-span-5">
          <QueryState
            query={festivals}
            loading={<LoadingBlock lines={3} label="Chargement des limites…" />}
            errorTitle="Limites indisponibles"
          >
            {(d) => <Limits kind={kind} count={text.length} festivals={d.festivals} />}
          </QueryState>
          {synopsisFeedbackAvailable ? <Coach key={kind} kind={kind} text={text} limit={minLimit} /> : null}
        </aside>
      </div>
    </div>
  );
}

export default function Synopsis() {
  return <WithProject>{(project) => <Page project={project} />}</WithProject>;
}
