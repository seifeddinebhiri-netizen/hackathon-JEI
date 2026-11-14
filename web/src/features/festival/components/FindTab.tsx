import { useEffect, useMemo, useState } from 'react';
import type { AiPolicy, FestivalMatch, FestivalSearchParams, FilmProfile, Project } from '@/api/types';
import {
  AiDraftBadge,
  Button,
  ButtonLink,
  Countdown,
  EmptyState,
  ErrorState,
  Field,
  Icon,
  Input,
  LoadingBlock,
  ScoreSquares,
  Select,
  StatusChip,
  useToast,
} from '@/components/ui';
import { useOptimisticProjectUpdate } from '@/features/planner/hooks/usePlanner';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/format';
import { useFestivalSearch } from '../hooks/useFestivals';
import {
  AI_POLICY_ICONS,
  AI_POLICY_LABELS,
  AI_POLICY_TONES,
  LANG_LABELS,
  RANKING_DISCLAIMER,
} from '../lib/labels';
import { buildShortlistItem, isVerified } from '../lib/shortlist';

type Filters = Omit<FestivalSearchParams, 'film'>;

function FilmProfileBand({
  profile,
  onChange,
}: {
  profile: FilmProfile;
  onChange: (p: FilmProfile) => void;
}) {
  return (
    <section aria-labelledby="ton-film" className="border-2 border-ink bg-ink p-4 text-paper md:p-5">
      <h2 id="ton-film" className="eyebrow text-gold">
        Ton film
      </h2>
      <div className="mt-3 grid grid-cols-2 gap-4 md:grid-cols-4 [&_label]:text-paper [&_p]:text-muted-on-dark">
        <Field label="Durée (min)">
          <Input
            type="number"
            min={1}
            max={300}
            value={profile.duration_min}
            onChange={(e) => onChange({ ...profile, duration_min: Number(e.target.value) || 0 })}
          />
        </Field>
        <Field label="Langue">
          <Input
            value={profile.language}
            onChange={(e) => onChange({ ...profile, language: e.target.value })}
          />
        </Field>
        <Field label="Genre">
          <Input value={profile.genre} onChange={(e) => onChange({ ...profile, genre: e.target.value })} />
        </Field>
        <Field label="Départements avec IA" hint="Depuis ton Passeport IA">
          <Input
            type="number"
            min={0}
            max={8}
            value={profile.declared_ai_departments}
            onChange={(e) => onChange({ ...profile, declared_ai_departments: Number(e.target.value) || 0 })}
          />
        </Field>
      </div>
    </section>
  );
}

function FestivalCard({
  m,
  ranked,
  selected,
  onAdd,
  adding,
}: {
  m: FestivalMatch;
  ranked: boolean;
  selected: boolean;
  onAdd: () => void;
  adding: boolean;
}) {
  const f = m.festival;
  return (
    <article aria-label={f.name} className="flex flex-col gap-4 border-2 border-ink bg-white p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-h3">{f.name}</h3>
          <p className="mt-1 text-meta text-muted-on-light">
            {f.country} · {f.fee} · {f.max_duration_min ? `${f.max_duration_min} min max.` : 'durée libre'} ·
            sous-titres {f.subtitle_langs.map((l) => LANG_LABELS[l] ?? l).join(', ')}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Countdown date={f.deadline} />
          <span className="text-meta text-muted-on-light">Limite : {formatDate(f.deadline)}</span>
        </div>
      </header>
      <div className="flex flex-wrap items-center gap-3">
        {ranked ? <ScoreSquares score={m.score} /> : null}
        <StatusChip tone={AI_POLICY_TONES[f.ai_policy]} icon={AI_POLICY_ICONS[f.ai_policy]}>
          {AI_POLICY_LABELS[f.ai_policy]}
        </StatusChip>
      </div>
      {ranked && (m.reasons.length || m.warnings.length) ? (
        <ul className="flex flex-col gap-1.5">
          {m.reasons.map((r) => (
            <li key={r} className="flex items-start gap-2 text-meta">
              <Icon name="check" size={16} className="mt-0.5 shrink-0 text-ok-fg" />
              <span>
                <span className="sr-only">Raison : </span>
                {r}
              </span>
            </li>
          ))}
          {m.warnings.map((w) => (
            <li key={w} className="flex items-start gap-2 text-meta font-semibold text-warn-fg">
              <Icon name="alert" size={16} className="mt-0.5 shrink-0" />
              <span>
                <span className="sr-only">Point de vigilance : </span>
                {w}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t-2 border-line-light pt-3">
        <p className="text-label text-muted-on-light">
          Source vérifiée le {formatDate(f.checked_at)} · données d’exemple
        </p>
        <div className="flex flex-wrap gap-2">
          <a
            href={f.source_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center gap-1.5 border-2 border-ink px-3 text-meta font-semibold hover:bg-gold-soft"
          >
            <Icon name="external" size={16} /> Fiche officielle
            <span className="sr-only"> (nouvel onglet)</span>
          </a>
          <Button
            size="sm"
            icon={selected ? 'check' : 'plus'}
            disabled={selected}
            loading={adding}
            onClick={onAdd}
          >
            {selected ? 'Dans ma sélection' : 'Ajouter à ma sélection'}
          </Button>
        </div>
      </footer>
    </article>
  );
}

export function FindTab({
  project,
  profile,
  onProfile,
}: {
  project: Project;
  profile: FilmProfile;
  onProfile: (p: FilmProfile) => void;
}) {
  const { toast } = useToast();
  const update = useOptimisticProjectUpdate(project.id);
  const [filters, setFilters] = useState<Filters>({});
  const [q, setQ] = useState('');
  const [ranked, setRanked] = useState(false);
  const [addingId, setAddingId] = useState<string>();

  // recherche texte : on attend la fin de la frappe
  useEffect(() => {
    const t = setTimeout(() => setFilters((f) => ({ ...f, q: q.trim() || undefined })), 300);
    return () => clearTimeout(t);
  }, [q]);

  const params: FestivalSearchParams = useMemo(
    () => (ranked ? { ...filters, film: profile } : filters),
    [filters, ranked, profile],
  );
  const search = useFestivalSearch(params);
  const all = useFestivalSearch({});
  const countries = [...new Set((all.data ?? []).map((m) => m.festival.country))].sort();
  const results = (search.data ?? []).filter((m) => isVerified(m.festival));
  const selectedIds = new Set(project.festival_shortlist.map((s) => s.festival_id));
  const setF = <K extends keyof Filters>(k: K, v: Filters[K]) =>
    setFilters((f) => ({ ...f, [k]: v || undefined }));
  const activeFilters = Object.values(filters).filter((v) => v !== undefined).length;

  const add = (m: FestivalMatch) => {
    setAddingId(m.festival.id);
    update.mutate(
      { festival_shortlist: [...project.festival_shortlist, buildShortlistItem(m.festival)] },
      {
        onSuccess: () =>
          toast({
            tone: 'ok',
            title: `${m.festival.name} ajouté à ta sélection`,
            description: 'Son dossier à préparer est prêt dans « Ma sélection ».',
          }),
        onError: (e) => toast({ tone: 'bad', title: 'Ajout impossible', description: e.message }),
        onSettled: () => setAddingId(undefined),
      },
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <FilmProfileBand profile={profile} onChange={onProfile} />

      <section
        aria-labelledby="filtres"
        className="flex flex-col gap-4 border-2 border-line-light bg-white p-4 md:p-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="filtres" className="eyebrow">
            Rechercher et filtrer
          </h2>
          {activeFilters || q ? (
            <Button
              variant="ghost"
              size="sm"
              icon="x"
              onClick={() => {
                setQ('');
                setFilters({});
              }}
            >
              Effacer les filtres
            </Button>
          ) : null}
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Recherche" className="sm:col-span-2 lg:col-span-4">
            <Input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Nom du festival ou pays"
            />
          </Field>
          <Field label="Pays">
            <Select value={filters.country ?? ''} onChange={(e) => setF('country', e.target.value)}>
              <option value="">Tous</option>
              {countries.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </Field>
          <Field label="Durée max acceptée" hint="Festivals qui acceptent au plus…">
            <Select
              value={filters.max_duration_min ?? ''}
              onChange={(e) => setF('max_duration_min', Number(e.target.value) || undefined)}
            >
              <option value="">Toutes</option>
              <option value="15">15 min</option>
              <option value="20">20 min</option>
              <option value="30">30 min</option>
              <option value="45">45 min</option>
            </Select>
          </Field>
          <Field label="Frais d’inscription">
            <Select
              value={filters.fee ?? ''}
              onChange={(e) => setF('fee', (e.target.value || undefined) as Filters['fee'])}
            >
              <option value="">Tous</option>
              <option value="gratuit">Gratuit</option>
              <option value="payant">Payant</option>
            </Select>
          </Field>
          <Field label="Date limite avant le">
            <Input
              type="date"
              value={filters.deadline_before ?? ''}
              onChange={(e) => setF('deadline_before', e.target.value)}
            />
          </Field>
          <Field label="Langue des sous-titres">
            <Select
              value={filters.subtitle_lang ?? ''}
              onChange={(e) => setF('subtitle_lang', e.target.value)}
            >
              <option value="">Toutes</option>
              {Object.entries(LANG_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Politique IA">
            <Select
              value={filters.ai_policy ?? ''}
              onChange={(e) => setF('ai_policy', e.target.value as AiPolicy)}
            >
              <option value="">Toutes</option>
              {(Object.keys(AI_POLICY_LABELS) as AiPolicy[]).map((p) => (
                <option key={p} value={p}>
                  {AI_POLICY_LABELS[p]}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex items-end sm:col-span-2 lg:col-span-2">
            <Button
              icon="sparkle"
              onClick={() => setRanked(true)}
              variant={ranked ? 'secondary' : 'primary'}
              className="w-full sm:w-auto"
            >
              {ranked ? 'Classé pour ton film' : 'Classer pour mon film'}
            </Button>
          </div>
        </div>
      </section>

      <p className="flex items-start gap-2 border-2 border-ink bg-gold-soft p-3">
        <Icon name="info" size={18} className="mt-0.5 shrink-0" />
        <span>{RANKING_DISCLAIMER}</span>
      </p>

      <section aria-labelledby="resultats" aria-live="polite">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <h2 id="resultats" className="text-h3">
            {search.isSuccess ? `${results.length} festival${results.length > 1 ? 's' : ''}` : 'Festivals'}
          </h2>
          {ranked ? <AiDraftBadge /> : null}
        </div>
        {search.isPending ? (
          <LoadingBlock lines={6} label="Recherche des festivals…" />
        ) : search.isError ? (
          <ErrorState error={search.error} onRetry={() => void search.refetch()} />
        ) : results.length === 0 ? (
          <EmptyState icon="film" title="Aucun festival ne correspond">
            Élargis les filtres : durée, frais ou date limite.
          </EmptyState>
        ) : (
          <div className={cn('grid grid-cols-1 gap-4', 'xl:grid-cols-2')}>
            {results.map((m) => (
              <FestivalCard
                key={m.festival.id}
                m={m}
                ranked={ranked}
                selected={selectedIds.has(m.festival.id)}
                adding={addingId === m.festival.id}
                onAdd={() => add(m)}
              />
            ))}
          </div>
        )}
        {project.festival_shortlist.length ? (
          <div className="mt-6">
            <ButtonLink to="/festival?onglet=selection" variant="secondary" iconRight="arrowRight">
              Voir ma sélection ({project.festival_shortlist.length})
            </ButtonLink>
          </div>
        ) : null}
      </section>
    </div>
  );
}
