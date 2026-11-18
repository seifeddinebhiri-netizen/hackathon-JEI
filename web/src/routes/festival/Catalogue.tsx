import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import type { FestivalMatch, FilmProfile, Project } from '@/api/types';
import {
  Button,
  ButtonLink,
  Checkbox,
  EmptyState,
  Field,
  Icon,
  Input,
  LoadingBlock,
  QueryState,
  Select,
  useToast,
} from '@/components/ui';
import {
  AiPolicyChip,
  DeadlineChip,
  FestivalPlate,
  KitHeader,
  SourceLine,
  WithProject,
} from '@/features/festival/components/Kit';
import { aiDepartments, deadlineText, feeText } from '@/features/festival/lib/kit';
import { useFestivalSearch, useShortlist } from '@/features/festival/hooks/useFestivals';
import { deptLabel } from '@/features/festival/lib/aiDeclaration';
import { newShortlistItem } from '@/features/festival/lib/dossier';
import {
  langList,
  RANKING_DISCLAIMER,
  REGION_LABELS,
  regionOf,
  type Region,
} from '@/features/festival/lib/labels';
import { defaultProfile, useProjectField } from '@/features/festival/lib/localStore';
import type { Passport } from '@/api/types';
import { cn } from '@/lib/cn';
import { toDate } from '@/lib/format';

type Sort = 'date' | 'prix';
const GROUP = { ouverte: 0, a_confirmer: 1, passee: 2 } as const;

function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** Montant le plus bas lisible dans le tarif (gratuit = 0, inconnu = à la fin). */
function feeAmount(fee: string): number {
  if (/^\s*gratuit/i.test(fee)) return 0;
  const n = /(\d+(?:[.,]\d+)?)/.exec(fee.replace(/\s(?=\d{3}\b)/g, ''))?.[1];
  return n ? Number(n.replace(',', '.')) : Number.POSITIVE_INFINITY;
}

function compareBy(sort: Sort, rank: boolean) {
  return (a: FestivalMatch, b: FestivalMatch) => {
    if (rank && a.score !== b.score) return b.score - a.score;
    if (sort === 'prix') {
      const d = feeAmount(a.festival.fee) - feeAmount(b.festival.fee);
      if (d) return d;
    }
    const ga = GROUP[a.festival.deadline_status];
    const gb = GROUP[b.festival.deadline_status];
    if (ga !== gb) return ga - gb;
    const ta = a.festival.deadline ? toDate(a.festival.deadline).getTime() : 0;
    const tb = b.festival.deadline ? toDate(b.festival.deadline).getTime() : 0;
    return ga === 2 ? tb - ta : ta - tb;
  };
}

function FilmBar({
  project,
  passport,
  rank,
  onRank,
}: {
  project: Project;
  passport: Passport | null | undefined;
  rank: boolean;
  onRank: (v: boolean) => void;
}) {
  const [profile, setProfile] = useProjectField(project, 'film_profile', defaultProfile(project.format));
  const [editing, setEditing] = useState(false);
  const used = passport?.declarations.filter((d) => d.used_ai) ?? [];
  return (
    <section aria-label="Ton film" className="flex flex-col gap-4 bg-ink p-4 text-paper md:p-5">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <span className="eyebrow text-gold">Ton film</span>
        <span className="font-display text-h3 font-bold">{project.title}</span>
        <span className="flex flex-wrap gap-x-5 gap-y-1 text-meta text-muted-on-dark">
          <span>
            <strong className="text-paper">{profile.duration_min} min</strong> · {profile.genre.toLowerCase()}
          </span>
          <span>
            Langue : <strong className="text-paper">{profile.language}</strong>
          </span>
          <span>
            IA déclarée :{' '}
            <strong className="text-paper">
              {used.length} département{used.length > 1 ? 's' : ''}
            </strong>
            {used.length ? ` (${used.map((d) => deptLabel(d.department).toLowerCase()).join(', ')})` : ''}
          </span>
        </span>
        <span className="flex flex-wrap items-center gap-3 lg:ml-auto">
          <Button
            variant="on-dark"
            size="sm"
            icon="edit"
            onClick={() => setEditing((e) => !e)}
            aria-expanded={editing}
          >
            Modifier
          </Button>
          <button
            type="button"
            aria-pressed={rank}
            onClick={() => onRank(!rank)}
            className={cn(
              'inline-flex min-h-11 items-center gap-2 border-2 border-gold px-4 text-meta font-semibold',
              rank ? 'bg-gold text-ink' : 'bg-transparent text-gold hover:bg-gold/10',
            )}
          >
            <Icon name="layers" size={18} />
            {rank ? 'Classés selon mon film' : 'Classer selon mon film'}
          </button>
        </span>
      </div>
      {editing ? (
        <div className="grid grid-cols-1 gap-4 border-t-2 border-line-dark pt-4 text-ink sm:grid-cols-3 [&_label]:text-paper">
          <Field label="Durée (min)">
            <Input
              type="number"
              min={1}
              max={600}
              value={profile.duration_min}
              onChange={(e) =>
                setProfile((p) => ({ ...p, duration_min: Math.max(1, Number(e.target.value) || 1) }))
              }
            />
          </Field>
          <Field label="Langue">
            <Input
              value={profile.language}
              onChange={(e) => setProfile((p) => ({ ...p, language: e.target.value }))}
            />
          </Field>
          <Field label="Genre">
            <Input
              value={profile.genre}
              onChange={(e) => setProfile((p) => ({ ...p, genre: e.target.value }))}
            />
          </Field>
          <p className="text-meta text-muted-on-dark sm:col-span-3">
            Le nombre de départements avec IA vient de ton Passeport IA. Enregistré automatiquement dans ton
            projet.
          </p>
        </div>
      ) : null}
    </section>
  );
}

function CompatLine({ match }: { match: FestivalMatch }) {
  const blocked = match.score === 1;
  const items = blocked
    ? match.warnings.slice(0, 1).map((t) => ({ t, tone: 'bad' as const }))
    : [
        ...match.reasons.slice(0, 1).map((t) => ({ t, tone: 'ok' as const })),
        ...match.warnings.slice(0, 1).map((t) => ({ t, tone: 'warn' as const })),
      ];
  if (!items.length) return null;
  return (
    <ul className="flex flex-col gap-1.5" aria-label="Compatibilité avec ton film">
      {items.map(({ t, tone }) => (
        <li
          key={t}
          className={cn(
            'flex items-start gap-2 text-meta font-semibold',
            tone === 'ok' ? 'text-ok-fg' : tone === 'bad' ? 'text-bad-fg' : 'text-warn-fg',
          )}
        >
          <Icon
            name={tone === 'ok' ? 'check' : tone === 'bad' ? 'x' : 'alert'}
            size={16}
            className="mt-0.5 shrink-0"
          />
          {t}
        </li>
      ))}
    </ul>
  );
}

function FestivalCard({
  match,
  inShortlist,
  onPrepare,
  preparing,
}: {
  match: FestivalMatch;
  inShortlist: boolean;
  onPrepare: () => void;
  preparing: boolean;
}) {
  const f = match.festival;
  const closed = f.deadline_status === 'passee';
  const nextYear = (f.deadline ? toDate(f.deadline).getFullYear() : new Date().getFullYear()) + 1;
  return (
    <article className="flex flex-col border-2 border-ink bg-white" aria-labelledby={`f-${f.id}`}>
      <FestivalPlate festival={f} className="h-36" />
      <div className="flex flex-1 flex-col gap-4 p-4 md:p-5">
        <div className="flex flex-wrap gap-2">
          <DeadlineChip festival={f} />
          <AiPolicyChip festival={f} />
        </div>
        <h3 id={`f-${f.id}`} className="text-[20px] leading-tight">
          {f.name}
        </h3>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-meta">
          {[
            ['Date limite', deadlineText(f)],
            ['Inscription', feeText(f.fee)],
            ['Durée max.', f.max_duration_min === null ? 'Non précisée' : `${f.max_duration_min} min`],
            ['Sous-titres', langList(f.subtitle_langs)],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="eyebrow text-muted-on-light">{k}</dt>
              <dd className="font-semibold">{v}</dd>
            </div>
          ))}
        </dl>
        {f.deadline_note && f.deadline_status !== 'ouverte' ? (
          <p className="flex items-start gap-2 border-l-4 border-line-light pl-3 text-meta">
            <Icon name="calendar" size={16} className="mt-0.5 shrink-0" />
            <span>
              <strong>Prochain appel : </strong>
              {f.deadline_note}
            </span>
          </p>
        ) : null}
        <CompatLine match={match} />
        <SourceLine festival={f} className="mt-auto" />
        <div className="flex flex-wrap gap-2">
          <ButtonLink to={`/festival/${encodeURIComponent(f.id)}`} variant="secondary" size="sm">
            Voir la fiche
          </ButtonLink>
          {inShortlist ? (
            <ButtonLink to="/festival/dossiers" size="sm" icon="check">
              Voir mon dossier
            </ButtonLink>
          ) : (
            <Button size="sm" onClick={onPrepare} loading={preparing}>
              {closed ? `Préparer pour ${nextYear}` : 'Préparer mon dossier'}
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}

function CatalogueBody({
  project,
  passport,
  passportReady,
}: {
  project: Project;
  passport: Passport | null | undefined;
  passportReady: boolean;
}) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const shortlist = useShortlist(project);
  const [stored] = useProjectField(project, 'film_profile', defaultProfile(project.format));
  const [query, setQuery] = useState('');
  const [openOnly, setOpenOnly] = useState(true);
  const [compatOnly, setCompatOnly] = useState(false);
  const [frOnly, setFrOnly] = useState(false);
  const [region, setRegion] = useState<Region | 'toutes'>('toutes');
  const [rank, setRank] = useState(true);
  const [sort, setSort] = useState<Sort>('date');
  const [preparing, setPreparing] = useState<string>();
  const q = useDebounced(query.trim());

  const film: FilmProfile = { ...stored, declared_ai_departments: aiDepartments(passport) };
  // Attend le Passeport : le nombre de départements avec IA entre dans le classement
  const all = useFestivalSearch({ film }, passportReady);
  const filtered = useFestivalSearch(
    {
      film,
      q: q || undefined,
      open_only: openOnly || undefined,
      subtitle_lang: frOnly ? 'fr' : undefined,
    },
    passportReady,
  );
  const shortIds = new Set(project.festival_shortlist.map((s) => s.festival_id));

  const items = useMemo(
    () =>
      (filtered.data ?? [])
        .filter((m) => !compatOnly || m.score > 1)
        .filter((m) => region === 'toutes' || regionOf(m.festival.country) === region)
        .sort(compareBy(sort, rank)),
    [filtered.data, compatOnly, region, sort, rank],
  );
  const total = all.data?.length;

  const prepare = (m: FestivalMatch) => {
    setPreparing(m.festival.id);
    shortlist
      .add(newShortlistItem(m.festival))
      .then(() => navigate(`/festival/${encodeURIComponent(m.festival.id)}#dossier`))
      .catch(() =>
        toast({
          tone: 'bad',
          title: 'Le dossier n’a pas pu être créé',
          description: 'Réessaie dans un instant.',
        }),
      )
      .finally(() => setPreparing(undefined));
  };

  return (
    <div className="flex flex-col gap-8">
      <KitHeader catalogueCount={total} dossierCount={project.festival_shortlist.length} />
      <FilmBar project={project} passport={passport} rank={rank} onRank={setRank} />

      <div className="flex flex-col gap-3 md:flex-row md:items-end">
        <Field label="Rechercher un festival" className="flex-1">
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nom du festival, ville ou pays (ex. Kélibia, Bruxelles, Égypte)"
          />
        </Field>
        <Field label="Trier" className="md:w-72">
          <Select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            <option value="date">Date limite la plus proche</option>
            <option value="prix">Inscription la moins chère</option>
          </Select>
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <aside aria-label="Filtres" className="flex flex-col gap-5 lg:col-span-3">
          <div>
            <h2 className="text-h3">Filtres</h2>
            <p className="text-meta text-muted-on-light" aria-live="polite">
              {filtered.data
                ? `${items.length} festivals affichés${total !== undefined ? ` sur ${total}` : ''}`
                : '…'}
            </p>
          </div>
          <div className="flex flex-col">
            <Checkbox checked={openOnly} onCheckedChange={setOpenOnly} label="Appels ouverts seulement" />
            <Checkbox
              checked={compatOnly}
              onCheckedChange={setCompatOnly}
              label="Compatibles avec mon film"
              hint="Selon le serveur : rien de bloquant dans le règlement."
            />
            <Checkbox checked={frOnly} onCheckedChange={setFrOnly} label="Sous-titres français acceptés" />
          </div>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-meta font-semibold">Région</legend>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(REGION_LABELS) as (Region | 'toutes')[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  aria-pressed={region === r}
                  onClick={() => setRegion(r)}
                  className={cn(
                    'min-h-11 border-2 border-ink px-3 text-meta font-semibold',
                    region === r ? 'bg-ink text-paper' : 'bg-white text-ink hover:bg-gold-soft',
                  )}
                >
                  {REGION_LABELS[r]}
                </button>
              ))}
            </div>
          </fieldset>
          <p className="flex items-start gap-2 border-2 border-warn-fg/30 bg-warn-bg p-3 text-meta text-warn-fg">
            <Icon name="info" size={18} className="mt-0.5 shrink-0" />
            {RANKING_DISCLAIMER}
          </p>
        </aside>

        <section aria-label="Festivals" className="flex flex-col gap-4 lg:col-span-9">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-display text-h3 font-bold">
              {filtered.data ? `${items.length} festivals` : 'Festivals'}
            </p>
            <p className="text-meta text-muted-on-light">
              {rank
                ? `Classés selon ${project.title} : compatibles d’abord, puis par ${sort === 'prix' ? 'tarif' : 'date limite'}.`
                : sort === 'prix'
                  ? 'Triés par tarif d’inscription.'
                  : 'Triés par date limite.'}
            </p>
          </div>
          <QueryState
            query={filtered}
            loading={<LoadingBlock lines={10} label="Chargement des festivals…" />}
            errorTitle="Le catalogue n’a pas pu être chargé"
            isEmpty={() => items.length === 0}
            empty={
              <EmptyState icon="film" title="Aucun festival ne correspond à ces filtres.">
                {openOnly
                  ? 'Décoche « Appels ouverts seulement » pour voir aussi les festivals à préparer pour l’an prochain.'
                  : 'Essaie une autre recherche ou une autre région.'}
              </EmptyState>
            }
          >
            {() => (
              <div
                className={cn(
                  'grid grid-cols-1 gap-5 md:grid-cols-2 2xl:grid-cols-3',
                  filtered.isFetching && 'opacity-70',
                )}
              >
                {items.map((m) => (
                  <FestivalCard
                    key={m.festival.id}
                    match={m}
                    inShortlist={shortIds.has(m.festival.id)}
                    onPrepare={() => prepare(m)}
                    preparing={preparing === m.festival.id}
                  />
                ))}
              </div>
            )}
          </QueryState>
        </section>
      </div>
    </div>
  );
}

export default function Catalogue() {
  return (
    <WithProject>
      {(project, passport) => (
        <CatalogueBody
          project={project}
          passport={passport.data}
          passportReady={passport.data !== undefined || passport.isError}
        />
      )}
    </WithProject>
  );
}
