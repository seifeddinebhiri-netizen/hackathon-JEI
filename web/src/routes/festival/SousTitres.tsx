import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import type { Project, SubtitleDraft, SubtitleLine } from '@/api/types';
import {
  AiDraftBadge,
  Button,
  ButtonLink,
  Field,
  Icon,
  Input,
  LoadingBlock,
  QueryState,
  SegmentedControl,
  StatusChip,
  useToast,
} from '@/components/ui';
import { Breadcrumb, WithProject } from '@/features/festival/components/Kit';
import { shortName } from '@/features/festival/lib/kit';
import { SubtitleImport } from '@/features/festival/components/SubtitleImport';
import { useFestival, useSaveSubtitles, useSubtitleDraft } from '@/features/festival/hooks/useFestivals';
import {
  CONFIDENCE_ICONS,
  CONFIDENCE_LABELS,
  CONFIDENCE_TONES,
  RULE_LABELS,
} from '@/features/festival/lib/labels';
import { riskScore } from '@/features/festival/lib/watch';
import { downloadSrt, exportBlocker, srtFileName, type SrtLang } from '@/features/festival/lib/srt';
import { cn } from '@/lib/cn';

function LineCard({
  line,
  edited,
  onSave,
  onToggle,
  busy,
}: {
  line: SubtitleLine;
  edited: boolean;
  onSave: (patch: Partial<SubtitleLine>) => void;
  onToggle: () => void;
  busy: boolean;
}) {
  const [fr, setFr] = useState(line.fr);
  const [en, setEn] = useState(line.en ?? '');
  const commit = () => {
    if (fr !== line.fr || en !== (line.en ?? '')) onSave({ fr, en });
  };
  return (
    <li
      className={cn(
        'flex flex-col gap-3 border-2 bg-white p-4 md:p-5',
        line.validated ? 'border-line-light' : 'border-dashed border-ink',
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-label text-muted-on-light">
          {line.start} → {line.end}
        </span>
        {line.speaker ? (
          <StatusChip icon="user" tone="neutral">
            Locuteur {line.speaker}
          </StatusChip>
        ) : null}
        <StatusChip tone={CONFIDENCE_TONES[line.confidence]} icon={CONFIDENCE_ICONS[line.confidence]}>
          {CONFIDENCE_LABELS[line.confidence]}
        </StatusChip>
        {line.validated ? (
          <StatusChip tone="ok" icon="check">
            Validée
          </StatusChip>
        ) : null}
      </div>
      <p className="font-semibold" lang="aeb-Latn">
        <span className="sr-only">Réplique originale en derja : </span>
        {line.source}
      </p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Field label="Français">
          <Input value={fr} onChange={(e) => setFr(e.target.value)} onBlur={commit} />
        </Field>
        <Field label="Anglais">
          <Input lang="en" value={en} onChange={(e) => setEn(e.target.value)} onBlur={commit} />
        </Field>
      </div>
      {line.note ? (
        <p className="flex items-start gap-2 border-l-4 border-gold bg-gold-soft/60 p-3 text-meta">
          <Icon name="doc" size={16} className="mt-0.5 shrink-0" />
          <span>
            <strong>{line.glossary_used?.length ? 'Glossaire derja : ' : 'Note du traducteur : '}</strong>
            {line.note}
          </span>
        </p>
      ) : null}
      {line.warnings?.map((w) => (
        <p
          key={w.rule + w.detail}
          className="flex items-start gap-2 border-2 border-warn-fg/30 bg-warn-bg p-3 text-meta text-warn-fg"
        >
          <Icon name="alert" size={16} className="mt-0.5 shrink-0" />
          <span>
            <strong>{RULE_LABELS[w.rule]} : </strong>
            {w.detail}
          </span>
        </p>
      ))}
      {edited ? <p className="text-meta text-muted-on-light">Modifié par toi.</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={line.validated ? 'secondary' : 'primary'}
          icon={line.validated ? undefined : 'check'}
          onClick={onToggle}
          disabled={busy}
        >
          {line.validated ? 'Annuler la validation' : 'Valider la ligne'}
        </Button>
        <ButtonLink
          to={`/festival/sous-titres/regarder?ligne=${encodeURIComponent(line.id)}`}
          size="sm"
          variant="ghost"
          icon="eye"
        >
          Voir dans la vidéo
        </ButtonLink>
      </div>
    </li>
  );
}

function AiSummary({ draft, director }: { draft: SubtitleDraft; director: string }) {
  const glossary = new Set(draft.lines.flatMap((l) => l.glossary_used ?? []));
  const ruled = draft.lines.filter((l) => l.warnings?.length).length;
  const tool = (s: string) => s.split('/').pop()?.replace(/_/g, ' ');
  return (
    <section
      aria-labelledby="ia-fait"
      className="flex flex-col gap-3 border-2 border-line-light bg-white p-5"
    >
      <h2 id="ia-fait" className="text-h3">
        Ce que l’IA a fait
      </h2>
      <ul className="flex list-disc flex-col gap-2 pl-5">
        <li>
          <strong>Transcription</strong> de la derja
          {draft.processing
            ? ` avec ${draft.processing.transcriber.split('/')[0]} (${tool(draft.processing.transcriber)})`
            : ''}
          .
        </li>
        <li>
          <strong>Traduction</strong> FR et EN
          {draft.processing ? ` avec ${tool(draft.processing.translator)}` : ''} et le glossaire derja :{' '}
          {glossary.size} expression{glossary.size > 1 ? 's' : ''} reconnue{glossary.size > 1 ? 's' : ''}.
        </li>
        <li>
          <strong>Règles de sous-titrage</strong> vérifiées par le code : {ruled} ligne{ruled > 1 ? 's' : ''}{' '}
          à revoir.
        </li>
      </ul>
      <p className="text-meta text-muted-on-light">
        L’audio a été supprimé du serveur après la transcription. Le Passeport IA pourra indiquer : «
        sous-titres assistés par IA, relus par {director} ».
      </p>
    </section>
  );
}

function Review({
  project,
  draft,
  festivalLabel,
}: {
  project: Project;
  draft: SubtitleDraft;
  festivalLabel?: string;
}) {
  const [params, setParams] = useSearchParams();
  const { toast } = useToast();
  const save = useSaveSubtitles(project.id);
  const lang: SrtLang = params.get('langue') === 'fr' ? 'fr' : 'en';
  const [filter, setFilter] = useState<'risque' | 'toutes'>('risque');
  const [edited, setEdited] = useState<Set<string>>(new Set());
  const [replacing, setReplacing] = useState(false);
  const lines = draft.lines;
  const validated = lines.filter((l) => l.validated).length;
  const blocker = exportBlocker(lines, lang);
  const risky = useMemo(
    () =>
      lines
        .map((l, i) => [l, i] as const)
        .filter(([l]) => riskScore(l) > 0)
        .sort((a, b) => riskScore(b[0]) - riskScore(a[0]) || a[1] - b[1])
        .map(([l]) => l),
    [lines],
  );
  const shown = filter === 'risque' ? risky : lines;
  const director = project.people.find((p) => /réalisation/i.test(p.role))?.name ?? 'toi';

  const update = (id: string, patch: Partial<SubtitleLine>) =>
    save.mutate(
      lines.map((l) => (l.id === id ? { ...l, ...patch } : l)),
      {
        onError: () =>
          toast({
            tone: 'bad',
            title: 'Modification non enregistrée',
            description: 'Réessaie dans un instant.',
          }),
      },
    );

  if (replacing) return <SubtitleImport project={project} replacing onCancel={() => setReplacing(false)} />;

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-4 border-2 border-ink bg-white p-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-[28px] leading-tight md:text-h2">
              {project.title} · {draft.source_lang} → anglais, français
            </h1>
            <AiDraftBadge validated={validated === lines.length} />
          </div>
          <p>
            <strong>
              {validated} / {lines.length} lignes validées
            </strong>{' '}
            · les lignes à risque sont en premier.
          </p>
          <div
            role="progressbar"
            aria-label="Lignes validées"
            aria-valuemin={0}
            aria-valuemax={lines.length}
            aria-valuenow={validated}
            className="h-2.5 w-full max-w-md bg-line-light"
          >
            <div
              className="h-full bg-ink"
              style={{ width: `${Math.round((validated / lines.length) * 100)}%` }}
            />
          </div>
        </div>
        <div className="flex flex-col gap-2 lg:items-end">
          <div className="flex flex-wrap items-end gap-3">
            <ButtonLink to={`/festival/sous-titres/regarder?langue=${lang}`} variant="secondary" icon="eye">
              Regarder et valider
            </ButtonLink>
            <SegmentedControl
              legend={<span className="sr-only">Langue du fichier</span>}
              value={lang}
              onChange={(v) => setParams((p) => (p.set('langue', v), p), { replace: true })}
              options={[
                { value: 'en', label: 'Anglais' },
                { value: 'fr', label: 'Français' },
              ]}
            />
            <Button
              icon={blocker ? 'lock' : 'download'}
              disabled={!!blocker}
              aria-describedby="export-note"
              onClick={() => downloadSrt(lines, lang, project.title)}
            >
              Exporter le .srt
            </Button>
          </div>
          <p id="export-note" className="text-meta text-muted-on-light">
            {blocker ?? `Toutes les lignes sont validées : ${srtFileName(project.title, lang)} est prêt.`}
          </p>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-start">
        <div className="flex flex-col gap-4 lg:col-span-4">
          <AiSummary draft={draft} director={director} />
          {festivalLabel ? (
            <p className="text-meta text-muted-on-light">
              Une seule relecture sert à tous tes dossiers qui demandent ces sous-titres (dont {festivalLabel}
              ).
            </p>
          ) : null}
          <Button variant="ghost" icon="upload" onClick={() => setReplacing(true)} className="self-start">
            Refaire le brouillon depuis ma vidéo
          </Button>
        </div>
        <section aria-label="Lignes de sous-titres" className="flex flex-col gap-4 lg:col-span-8">
          <div role="group" aria-label="Filtre" className="flex w-fit border-2 border-ink">
            {(
              [
                ['risque', `À vérifier d’abord (${risky.length})`],
                ['toutes', `Toutes (${lines.length})`],
              ] as const
            ).map(([v, label], i) => (
              <button
                key={v}
                type="button"
                aria-pressed={filter === v}
                onClick={() => setFilter(v)}
                className={cn(
                  'min-h-11 px-4 text-meta font-semibold',
                  i > 0 && 'border-l-2 border-ink',
                  filter === v ? 'bg-ink text-paper' : 'bg-white text-ink hover:bg-gold-soft',
                )}
              >
                {label}
              </button>
            ))}
          </div>
          {shown.length ? (
            <ol className="flex flex-col gap-4">
              {shown.map((l) => (
                <LineCard
                  key={`${l.id}-${l.fr}-${l.en ?? ''}`}
                  line={l}
                  edited={edited.has(l.id)}
                  busy={save.isPending}
                  onSave={(patch) => {
                    setEdited((s) => new Set(s).add(l.id));
                    update(l.id, patch);
                  }}
                  onToggle={() => update(l.id, { validated: !l.validated })}
                />
              ))}
            </ol>
          ) : (
            <p className="border-2 border-dashed border-line-light bg-white p-5 text-meta">
              Aucune ligne à risque. Passe sur « Toutes » pour tout relire.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

function Page({ project }: { project: Project }) {
  const [params] = useSearchParams();
  const dossierId = params.get('dossier') ?? undefined;
  const festival = useFestival(dossierId);
  const draft = useSubtitleDraft(project.id);
  const lang = params.get('langue') === 'fr' ? 'français' : 'anglais';
  const crumbs = [
    { label: 'Mes dossiers', to: '/festival/dossiers' },
    ...(festival.data
      ? [
          {
            label: `Dossier ${shortName(festival.data)}`,
            to: `/festival/${encodeURIComponent(festival.data.id)}`,
          },
        ]
      : []),
    { label: `Sous-titres ${lang}` },
  ];
  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb items={crumbs} />
      <QueryState
        query={draft}
        loading={<LoadingBlock lines={10} label="Chargement des sous-titres…" />}
        errorTitle="Les sous-titres n’ont pas pu être chargés"
        isEmpty={(d) => d.lines.length === 0}
        empty={<SubtitleImport project={project} />}
      >
        {(d) => (
          <Review
            project={project}
            draft={d}
            festivalLabel={festival.data ? shortName(festival.data) : undefined}
          />
        )}
      </QueryState>
    </div>
  );
}

export default function SousTitres() {
  return <WithProject>{(project) => <Page project={project} />}</WithProject>;
}
