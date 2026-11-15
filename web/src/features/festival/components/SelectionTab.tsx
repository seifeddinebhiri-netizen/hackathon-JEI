import { Link } from 'react-router';
import { BabaJamil } from '@/components/BabaJamil';
import type { Festival, Project, ShortlistItem } from '@/api/types';
import {
  Button,
  ButtonLink,
  Checkbox,
  Countdown,
  EmptyState,
  ErrorState,
  Icon,
  LoadingBlock,
  SegmentedControl,
  StatusChip,
  useToast,
} from '@/components/ui';
import { useOptimisticProjectUpdate } from '@/features/planner/hooks/usePlanner';
import { cn } from '@/lib/cn';
import { daysUntil, formatDate } from '@/lib/format';
import { useFestivalSearch } from '../hooks/useFestivals';
import {
  REQUIREMENT_LABELS,
  REQUIREMENT_TOOLS,
  SHORTLIST_STATUS_LABELS,
  SHORTLIST_STATUS_TONES,
} from '../lib/labels';
import { progress } from '../lib/shortlist';

function Timeline({ entries }: { entries: { f: Festival; item: ShortlistItem }[] }) {
  return (
    <section aria-labelledby="frise" className="border-2 border-ink bg-ink p-5 text-paper">
      <h2 id="frise" className="eyebrow text-gold">
        Frise des dates limites
      </h2>
      <ol className="mt-5 flex flex-col gap-0 md:flex-row md:items-start">
        {entries.map(({ f, item }, i) => {
          const d = daysUntil(f.deadline);
          return (
            <li key={f.id} className="relative flex gap-3 pb-5 md:flex-1 md:flex-col md:pr-4 md:pb-0">
              {/* trait de la frise */}
              <span
                aria-hidden
                className={cn(
                  'absolute top-3 left-[9px] h-full w-0.5 bg-line-dark md:top-[9px] md:left-0 md:h-0.5 md:w-full',
                  i === entries.length - 1 && 'md:w-1/2',
                )}
              />
              <span
                aria-hidden
                className={cn(
                  'relative z-10 size-5 shrink-0 border-2 border-paper',
                  d >= 0 && d <= 14 ? 'bg-brand-red' : 'bg-gold',
                )}
              />
              <div className="flex flex-col gap-1">
                <span className="font-mono text-label text-muted-on-dark">{formatDate(f.deadline)}</span>
                <a href={`#dossier-${f.id}`} className="font-semibold underline-offset-4 hover:underline">
                  {f.name}
                </a>
                <span className="flex flex-wrap items-center gap-2">
                  <Countdown date={f.deadline} className="border-paper bg-transparent text-paper" />
                  <span className="text-meta text-muted-on-dark">{progress(item)} % prêt</span>
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function Dossier({
  f,
  item,
  onChange,
  onRemove,
}: {
  f: Festival;
  item: ShortlistItem;
  onChange: (i: ShortlistItem) => void;
  onRemove: () => void;
}) {
  const pct = progress(item);
  return (
    <article
      id={`dossier-${f.id}`}
      aria-labelledby={`titre-${f.id}`}
      className="scroll-mt-24 border-2 border-ink bg-white"
    >
      <header className="flex flex-wrap items-start justify-between gap-3 border-b-2 border-ink p-4 md:p-5">
        <div>
          <h3 id={`titre-${f.id}`} className="text-h3">
            {f.name}
          </h3>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-meta text-muted-on-light">
            Limite le {formatDate(f.deadline)} <Countdown date={f.deadline} />
          </p>
        </div>
        <StatusChip
          tone={SHORTLIST_STATUS_TONES[item.status]}
          icon={item.status === 'soumis' ? 'check' : item.status === 'pret' ? 'check' : 'clock'}
        >
          {SHORTLIST_STATUS_LABELS[item.status]}
        </StatusChip>
      </header>

      <div className="flex flex-col gap-4 p-4 md:p-5">
        <div className="flex items-center gap-3">
          <div
            className="h-3 flex-1 border-2 border-ink"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Dossier ${f.name} préparé`}
          >
            <div className={cn('h-full', pct === 100 ? 'bg-ok-fg' : 'bg-ink')} style={{ width: `${pct}%` }} />
          </div>
          <span className="font-mono text-label">{pct} %</span>
        </div>

        <ul className="flex flex-col divide-y divide-line-light">
          {item.checklist.map((c, idx) => {
            const tool = REQUIREMENT_TOOLS[c.requirement.kind];
            return (
              <li key={idx} className="flex flex-wrap items-center justify-between gap-2 py-1">
                <Checkbox
                  checked={c.done}
                  onCheckedChange={(v) =>
                    onChange({
                      ...item,
                      checklist: item.checklist.map((x, j) => (j === idx ? { ...x, done: v } : x)),
                    })
                  }
                  label={<span className="font-semibold">{REQUIREMENT_LABELS[c.requirement.kind]}</span>}
                  hint={c.requirement.detail}
                />
                {tool ? (
                  <Link
                    to={tool.to}
                    className="inline-flex min-h-11 items-center gap-1 text-meta font-semibold underline underline-offset-4"
                  >
                    {tool.label} <Icon name="arrowRight" size={14} />
                  </Link>
                ) : (
                  <span className="text-meta text-muted-on-light">Hors de l’application</span>
                )}
              </li>
            );
          })}
        </ul>

        <div className="flex flex-col gap-3 border-t-2 border-line-light pt-4 md:flex-row md:items-end md:justify-between">
          <SegmentedControl
            legend="Statut"
            value={item.status}
            onChange={(status) => onChange({ ...item, status })}
            options={[
              { value: 'a_preparer', label: 'À préparer' },
              { value: 'pret', label: 'Prêt' },
              { value: 'soumis', label: 'Soumis' },
            ]}
          />
          <div className="flex flex-wrap gap-2">
            <a
              href={f.source_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center gap-1.5 border-2 border-ink px-3 text-meta font-semibold hover:bg-gold-soft"
            >
              <Icon name="external" size={16} /> Soumettre sur le site officiel
            </a>
            <Button variant="ghost" size="sm" icon="trash" onClick={onRemove}>
              Retirer<span className="sr-only"> {f.name} de ma sélection</span>
            </Button>
          </div>
        </div>
        {pct === 100 && item.status === 'a_preparer' ? (
          <p className="flex items-center gap-1.5 text-meta text-ok-fg">
            <Icon name="check" size={16} /> Tout est coché : tu peux passer ce dossier à « Prêt ».
          </p>
        ) : null}
        <p className="text-meta text-muted-on-light">
          La soumission et le paiement se font sur le site officiel du festival. Marque « Soumis » ici une
          fois que c’est fait.
        </p>
      </div>
    </article>
  );
}

export function SelectionTab({ project }: { project: Project }) {
  const all = useFestivalSearch({});
  const update = useOptimisticProjectUpdate(project.id);
  const { toast } = useToast();
  const list = project.festival_shortlist;

  if (!list.length) {
    return (
      <EmptyState
        icon="film"
        title="Ta sélection est vide"
        action={
          <ButtonLink to="/festival?onglet=trouver" iconRight="arrowRight">
            Trouver un festival
          </ButtonLink>
        }
      >
        Ajoute des festivals depuis « Trouver mon festival » : leurs dates limites et leurs dossiers à
        préparer apparaîtront ici.
      </EmptyState>
    );
  }
  if (all.isPending) return <LoadingBlock lines={6} />;
  if (all.isError) return <ErrorState error={all.error} onRetry={() => void all.refetch()} />;

  const byId = new Map(all.data.map((m) => [m.festival.id, m.festival]));
  const entries = list
    .map((item) => ({ item, f: byId.get(item.festival_id) }))
    .filter((e): e is { item: ShortlistItem; f: Festival } => !!e.f)
    .sort((a, b) => a.f.deadline.localeCompare(b.f.deadline));

  const save = (next: ShortlistItem[]) =>
    update.mutate(
      { festival_shortlist: next },
      {
        onError: (e) => toast({ tone: 'bad', title: 'Modification non enregistrée', description: e.message }),
      },
    );

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-[1fr_auto]">
        <Timeline entries={entries} />
        <BabaJamil pose="diffuser" taille="m" className="hidden md:block" />
      </div>
      {entries.map(({ f, item }) => (
        <Dossier
          key={f.id}
          f={f}
          item={item}
          onChange={(it) => save(list.map((x) => (x.festival_id === it.festival_id ? it : x)))}
          onRemove={() => save(list.filter((x) => x.festival_id !== f.id))}
        />
      ))}
    </div>
  );
}
