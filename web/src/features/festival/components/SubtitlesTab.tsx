import { useState } from 'react';
import type { Project, SubtitleLine } from '@/api/types';
import {
  AiDraftBadge,
  Button,
  Checkbox,
  EmptyState,
  ErrorState,
  Field,
  Icon,
  Input,
  LoadingBlock,
  SegmentedControl,
  StatusChip,
  useToast,
} from '@/components/ui';
import { cn } from '@/lib/cn';
import { downloadBlob } from '@/lib/print';
import { useSaveSubtitles, useSubtitleDraft } from '../hooks/useFestivals';
import { CONFIDENCE_ICONS, CONFIDENCE_LABELS, CONFIDENCE_TONES } from '../lib/labels';
import { allValidated, toSrt } from '../lib/srt';

function LineRow({ line, onChange }: { line: SubtitleLine; onChange: (l: SubtitleLine) => void }) {
  const [editing, setEditing] = useState(false);
  const [fr, setFr] = useState(line.fr);
  const [en, setEn] = useState(line.en ?? '');

  return (
    <li
      className={cn(
        'grid grid-cols-1 gap-3 border-2 bg-white p-4 md:grid-cols-12',
        line.validated ? 'border-line-light' : 'border-dashed border-ink',
      )}
    >
      <div className="flex flex-col gap-2 md:col-span-4">
        <p className="font-mono text-label text-muted-on-light">
          {line.start} → {line.end}
        </p>
        <p className="font-semibold" lang="aeb-Latn">
          <span className="sr-only">Réplique originale en derja : </span>
          {line.source}
        </p>
        <StatusChip
          tone={CONFIDENCE_TONES[line.confidence]}
          icon={CONFIDENCE_ICONS[line.confidence]}
          className="self-start"
        >
          {CONFIDENCE_LABELS[line.confidence]}
        </StatusChip>
      </div>
      <div className="flex flex-col gap-2 md:col-span-6">
        {editing ? (
          <>
            <Field label="Français">
              <Input value={fr} onChange={(e) => setFr(e.target.value)} />
            </Field>
            <Field label="Anglais" optional>
              <Input lang="en" value={en} onChange={(e) => setEn(e.target.value)} />
            </Field>
          </>
        ) : (
          <>
            <p>
              <span className="eyebrow mr-2 text-muted-on-light">FR</span>
              {line.fr}
            </p>
            {line.en ? (
              <p lang="en">
                <span className="eyebrow mr-2 text-muted-on-light">EN</span>
                {line.en}
              </p>
            ) : null}
          </>
        )}
        {line.note ? (
          <p className="flex items-start gap-2 border-l-4 border-gold bg-gold-soft/50 p-2 text-meta">
            <Icon name="info" size={14} className="mt-0.5 shrink-0" />
            <span>
              <strong>Note du traducteur : </strong>
              {line.note}
            </span>
          </p>
        ) : null}
      </div>
      <div className="flex flex-row flex-wrap items-start gap-2 md:col-span-2 md:flex-col md:items-stretch">
        {editing ? (
          <>
            <Button
              size="sm"
              icon="check"
              disabled={!fr.trim()}
              onClick={() => {
                onChange({ ...line, fr: fr.trim(), en: en.trim() || undefined, validated: true });
                setEditing(false);
              }}
            >
              Enregistrer et valider
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
              Annuler
            </Button>
          </>
        ) : (
          <>
            {line.validated ? (
              <StatusChip tone="ok">Validée</StatusChip>
            ) : (
              <Button size="sm" icon="check" onClick={() => onChange({ ...line, validated: true })}>
                Valider
              </Button>
            )}
            <Button
              variant="secondary"
              size="sm"
              icon="edit"
              onClick={() => {
                setFr(line.fr);
                setEn(line.en ?? '');
                setEditing(true);
              }}
            >
              Modifier
            </Button>
          </>
        )}
      </div>
    </li>
  );
}

export function SubtitlesTab({ project }: { project: Project }) {
  const draft = useSubtitleDraft(project.id);
  const save = useSaveSubtitles(project.id);
  const { toast } = useToast();
  const [lang, setLang] = useState<'fr' | 'en'>('fr');
  const [onlyTodo, setOnlyTodo] = useState(false);

  if (draft.isPending) return <LoadingBlock lines={8} label="Chargement des sous-titres…" />;
  if (draft.isError) return <ErrorState error={draft.error} onRetry={() => void draft.refetch()} />;
  const lines = draft.data.lines;
  if (!lines.length)
    return (
      <EmptyState icon="doc" title="Pas encore de brouillon de sous-titres">
        Le brouillon derja → français sera proposé à partir des dialogues du film monté.
      </EmptyState>
    );

  const validated = lines.filter((l) => l.validated).length;
  const ready = allValidated(lines);
  const missingEn = lang === 'en' && lines.some((l) => !l.en?.trim());
  const update = (l: SubtitleLine) =>
    save.mutate(
      lines.map((x) => (x.id === l.id ? l : x)),
      { onError: (e) => toast({ tone: 'bad', title: 'Ligne non enregistrée', description: e.message }) },
    );
  const shown = onlyTodo ? lines.filter((l) => !l.validated) : lines;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 border-2 border-ink bg-white p-4 md:flex-row md:items-end md:justify-between md:p-5">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-h3">Derja → français et anglais</h2>
            <AiDraftBadge validated={ready} />
          </div>
          <p className="text-meta text-muted-on-light">
            {validated}/{lines.length} lignes validées. Relis chaque ligne : la traduction est un brouillon,
            en particulier pour les expressions idiomatiques.
          </p>
          <div
            className="h-3 max-w-md border-2 border-ink"
            role="progressbar"
            aria-valuenow={validated}
            aria-valuemin={0}
            aria-valuemax={lines.length}
            aria-label="Lignes validées"
          >
            <div className="h-full bg-ink" style={{ width: `${(validated / lines.length) * 100}%` }} />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-end gap-3">
            <SegmentedControl
              legend="Langue du fichier"
              value={lang}
              onChange={setLang}
              options={[
                { value: 'fr', label: 'Français' },
                { value: 'en', label: 'Anglais' },
              ]}
            />
            <Button
              icon="download"
              disabled={!ready || missingEn}
              onClick={() =>
                downloadBlob(
                  new Blob([toSrt(lines, lang)], { type: 'application/x-subrip;charset=utf-8' }),
                  `${project.title.toLowerCase().replace(/\W+/g, '-')}-${lang}.srt`,
                )
              }
            >
              Exporter le .srt
            </Button>
          </div>
          {!ready ? (
            <p className="flex items-center gap-1.5 text-meta text-warn-fg">
              <Icon name="lock" size={14} /> Export possible quand toutes les lignes sont validées.
            </p>
          ) : missingEn ? (
            <p className="text-meta text-warn-fg">Certaines lignes n’ont pas de version anglaise.</p>
          ) : null}
        </div>
      </div>

      <Checkbox
        checked={onlyTodo}
        onCheckedChange={setOnlyTodo}
        label={<span className="text-meta font-semibold">N’afficher que les lignes à valider</span>}
        className="self-start"
      />

      <ol className="flex flex-col gap-3" aria-label="Lignes de sous-titres">
        {shown.map((l) => (
          <LineRow key={l.id} line={l} onChange={update} />
        ))}
      </ol>
      {onlyTodo && shown.length === 0 ? (
        <p className="flex items-center gap-1.5 text-ok-fg">
          <Icon name="check" size={18} /> Toutes les lignes sont validées.
        </p>
      ) : null}
    </div>
  );
}
