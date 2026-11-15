import { forwardRef, useImperativeHandle, useState } from 'react';
import type {
  Location,
  LocationProposition,
  LocationSuggestResult,
  PlaceCandidate,
  Project,
  Scene,
} from '@/api/types';
import { AiDraftBadge, Button, Icon, Skeleton, StatusChip } from '@/components/ui';
import { cn } from '@/lib/cn';
import { cachedLocationSuggestion, useSuggestLocations } from '../../hooks/usePlanner';
import { buildSuggestInput } from './locationSuggestInput';
import { SHELTER_CONSTRAINT } from './weatherVerdict';

const FACILITE: Record<LocationProposition['facilite'], string> = {
  facile: 'Facile à obtenir',
  moyenne: 'Moyennement facile',
  difficile: 'Difficile à obtenir',
};

function appendNote(notes: string | undefined, line: string): string {
  const current = notes?.trim() ?? '';
  return current.includes(line) ? current : current ? `${current}\n${line}` : line;
}

function Needs({ besoins }: { besoins: LocationSuggestResult['besoins'] }) {
  const groups = [
    { label: 'À l’image', items: besoins.a_voir },
    { label: 'Ce qu’on y fait', items: besoins.actions },
    { label: 'Côté pratique', items: besoins.pratique },
  ].filter((g) => g.items.length);
  return (
    <section aria-label="Ce que tes scènes demandent" className="border-2 border-line-light bg-white p-4">
      <h4 className="text-body">Ce que tes scènes demandent</h4>
      {besoins.ambiance ? <p className="mt-1 text-meta">{besoins.ambiance}</p> : null}
      <div className="mt-2 flex flex-col gap-2">
        {groups.map((g) => (
          <div key={g.label}>
            <p className="text-meta font-semibold text-muted-on-light">{g.label}</p>
            <ul className="mt-1 flex flex-wrap gap-1.5">
              {g.items.map((it) => (
                <li key={it} className="border border-line-light bg-paper px-2 py-0.5 text-meta">
                  {it}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

function PropositionCard({
  p,
  location,
  onChoose,
  onSearchMyself,
}: {
  p: LocationProposition;
  location: Location;
  onChoose: (p: LocationProposition, c: PlaceCandidate) => void;
  onSearchMyself: (p: LocationProposition) => void;
}) {
  return (
    <li className="flex flex-col gap-2 border-2 border-ink bg-white p-4">
      <AiDraftBadge className="self-start" />
      <h4 className="text-body leading-snug">{p.type_de_lieu}</h4>
      <p className="text-meta">{p.pourquoi}</p>
      <p className="flex flex-wrap gap-1.5">
        <StatusChip tone="neutral">{FACILITE[p.facilite]}</StatusChip>
        {p.autorisation_probable === 'a_demander' ? (
          <StatusChip tone="warn" icon="doc">
            Autorisation : à demander
          </StatusChip>
        ) : null}
      </p>
      <p className="text-meta text-muted-on-light">Où chercher : {p.zone}</p>

      {p.candidates.length ? (
        <ul className="mt-1 flex flex-col divide-y-2 divide-line-light border-y-2 border-line-light">
          {p.candidates.map((c) => {
            const chosen = location.lat === c.lat && location.lon === c.lon;
            return (
              <li key={`${c.lat},${c.lon}`} className="flex flex-col gap-1 py-2">
                <span className="font-semibold">{c.name}</span>
                <span className="text-meta text-muted-on-light">{c.address}</span>
                <span className="flex flex-wrap items-center gap-x-3">
                  <a
                    href={c.osm_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 items-center gap-1 text-meta font-semibold underline underline-offset-4"
                  >
                    Voir sur la carte<span className="sr-only"> : {c.name} (nouvel onglet)</span>
                  </a>
                  {chosen ? (
                    <StatusChip tone="ok" icon="check">
                      Lieu choisi
                    </StatusChip>
                  ) : (
                    <Button size="sm" variant="secondary" icon="check" onClick={() => onChoose(p, c)}>
                      Choisir ce lieu<span className="sr-only"> : {c.name}</span>
                    </Button>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="mt-1 border-y-2 border-line-light py-2">
          <p className="text-meta font-semibold">Aucun lieu trouvé automatiquement</p>
          <Button size="sm" variant="ghost" icon="pin" onClick={() => onSearchMyself(p)} className="-ml-3">
            Chercher moi-même
          </Button>
        </div>
      )}

      {p.a_verifier_sur_place.length ? (
        <p className="text-meta">
          <span className="font-semibold">À vérifier sur place : </span>
          {p.a_verifier_sur_place.join(', ')}.
        </p>
      ) : null}
    </li>
  );
}

/**
 * Lieux proposés par l'IA pour ce décor : ce que les scènes demandent, puis 3 types de lieux avec
 * de vrais lieux trouvés sur la carte. Tout reste facultatif : on peut remplir le lieu à la main.
 */
/** Commande exposée au panneau météo : demander des lieux abrités. */
export type LocationSuggestionsHandle = { askSheltered: () => void };

type Props = {
  project: Project;
  location: Location;
  scenes: Scene[];
  otherDecors: string[];
  onChange: (l: Location) => void;
  addressInputId: string;
};

export const LocationSuggestions = forwardRef<LocationSuggestionsHandle, Props>(function LocationSuggestions(
  { project, location, scenes, otherDecors, onChange, addressInputId },
  ref,
) {
  const suggest = useSuggestLocations();
  const [exclude, setExclude] = useState<string[]>([]);
  const [constraints, setConstraints] = useState<string[]>([]);
  const [result, setResult] = useState<LocationSuggestResult | undefined>(() =>
    cachedLocationSuggestion(location.id, buildSuggestInput(project, location, scenes, otherDecors, [])),
  );
  const ready = !!location.name.trim() && scenes.length > 0 && !!project.city.trim();

  const sectionId = `propositions-${location.id}`;
  const run = (nextExclude: string[], nextConstraints: string[] = constraints) => {
    setExclude(nextExclude);
    setConstraints(nextConstraints);
    suggest.mutate(
      {
        decorId: location.id,
        input: buildSuggestInput(project, location, scenes, otherDecors, nextExclude, nextConstraints),
      },
      { onSuccess: setResult },
    );
  };

  // La météo menace les scènes en extérieur : on demande des lieux abrités (sans reproposer les mêmes)
  useImperativeHandle(ref, () => ({
    askSheltered: () => {
      run(
        [...new Set([...exclude, ...(result?.propositions.map((p) => p.type_de_lieu) ?? [])])],
        [SHELTER_CONSTRAINT],
      );
      document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
  }));

  const choose = (p: LocationProposition, c: PlaceCandidate) =>
    onChange({
      ...location,
      // Le nom du décor (celui du script) ne change pas
      address: c.address,
      lat: c.lat,
      lon: c.lon,
      permit: p.autorisation_probable === 'a_demander' ? 'a_demander' : location.permit,
      notes: appendNote(location.notes, `Choisi parmi les propositions IA : ${p.type_de_lieu}`),
    });

  const searchMyself = (p: LocationProposition) => {
    onChange({
      ...location,
      address: `${p.requete_recherche}, ${project.city}`,
      lat: undefined,
      lon: undefined,
    });
    document.getElementById(addressInputId)?.focus();
  };

  return (
    <section
      id={sectionId}
      aria-label="Lieux proposés pour ce décor"
      className="mb-5 flex scroll-mt-24 flex-col gap-4"
    >
      {constraints.length && (result || suggest.isPending) ? (
        <p className="flex items-center gap-2 text-meta font-semibold">
          <Icon name="rain" size={16} /> Lieux abrités, à cause de la météo prévue pendant le tournage.
        </p>
      ) : null}
      {!result && !suggest.isPending ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" icon="pin" disabled={!ready} onClick={() => run([])}>
            Proposer des lieux pour ce décor
          </Button>
          <p className="text-meta text-muted-on-light">
            {ready
              ? 'L’IA lit les scènes de ce décor et propose des types de lieux, avec de vrais lieux sur la carte.'
              : 'Donne un nom à ce décor et associe-lui au moins une scène pour recevoir des propositions.'}
          </p>
        </div>
      ) : null}

      {suggest.isPending ? (
        <div role="status" className="flex flex-col gap-3 border-2 border-line-light bg-white p-4">
          <p className="flex items-center gap-2 font-semibold">
            <Icon name="pin" size={18} /> On cherche des lieux qui collent à tes scènes…
          </p>
          <Skeleton className="h-4 w-2/3" />
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            <Skeleton className="h-40" />
            <Skeleton className="h-40" />
            <Skeleton className="h-40" />
          </div>
        </div>
      ) : null}

      {suggest.isError ? (
        <p role="alert" className="flex flex-wrap items-center gap-2 text-meta font-semibold text-bad-fg">
          <Icon name="alert" size={16} /> {suggest.error.message}
          <Button size="sm" variant="ghost" onClick={() => run(exclude)}>
            Réessayer
          </Button>
        </p>
      ) : null}

      {result && !suggest.isPending ? (
        <>
          <Needs besoins={result.besoins} />
          {result.mutualisation ? (
            <p className="flex items-start gap-2 border-2 border-ok-fg/40 bg-ok-bg p-3 text-meta text-ok-fg">
              <Icon name="layers" size={16} className="mt-0.5 shrink-0" />
              <span>
                Ce lieu peut aussi servir pour <strong>{result.mutualisation}</strong> : une journée de
                déplacement en moins.
              </span>
            </p>
          ) : null}
          {result.propositions.length ? (
            <ul className={cn('grid grid-cols-1 gap-3', result.propositions.length > 1 && 'lg:grid-cols-3')}>
              {result.propositions.map((p) => (
                <PropositionCard
                  key={p.type_de_lieu}
                  p={p}
                  location={location}
                  onChoose={choose}
                  onSearchMyself={searchMyself}
                />
              ))}
            </ul>
          ) : (
            <p className="text-meta text-muted-on-light">Plus d’autre proposition pour ce décor.</p>
          )}
          <p className="flex flex-wrap items-center gap-x-4 text-meta text-muted-on-light">
            <button
              type="button"
              disabled={!ready}
              onClick={() =>
                run([...new Set([...exclude, ...result.propositions.map((p) => p.type_de_lieu)])])
              }
              className="inline-flex min-h-11 items-center font-semibold text-ink underline underline-offset-4"
            >
              Proposer d’autres lieux
            </button>
            <span>Tu peux aussi ignorer ces propositions et remplir le lieu à la main.</span>
          </p>
        </>
      ) : null}
    </section>
  );
});
