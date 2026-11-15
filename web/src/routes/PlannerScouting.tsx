import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button, ButtonLink, Field, Input, PageHeader, Select } from '@/components/ui';
import { useCurrentProject } from '@/features/project/hooks/useProject';
import { readSession } from '@/features/planner/scenario/storage';
import {
  categories,
  DEFAULT_REQUIREMENTS,
  evaluateLocations,
  getLocationWeather,
  interpretScene,
  requirementsSchema,
  searchLocations,
  type Category,
  type Requirements,
  type Slot,
} from '@/features/planner/scouting/api';
import ScoutingMap from '@/features/planner/scouting/ScoutingMap';
import { WeatherPanel } from '@/features/planner/scouting/WeatherPanel';
import { localTime } from '@/features/planner/scouting/solar';
import { readChoices, saveChoice, SCOUTING_KEY, type ScoutChoice } from '@/features/planner/scouting/storage';

const moments = { DAY: 'Jour', NIGHT: 'Nuit', DAWN: 'Aube', DUSK: 'Crépuscule', UNKNOWN: 'À préciser' };
const labels = {
  favorable: 'Compatible avec les critères',
  a_verifier: 'À vérifier',
  defavorable: 'Défavorable',
  unavailable: 'Indisponible',
};
const thresholds = {
  max_wind_kmh: 'Vent maximal (km/h)',
  max_precipitation_mm: 'Précipitations maximales (mm/h)',
  min_cloud_pct: 'Nuages minimum (%)',
  max_cloud_pct: 'Nuages maximum (%)',
  min_temperature_c: 'Température minimale (°C)',
  max_temperature_c: 'Température maximale (°C)',
} as const;
const message = (e: unknown) => (e instanceof Error ? e.message : 'La demande a échoué. Réessaie.');
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function PlannerScouting() {
  const project = useCurrentProject();
  const [scenario] = useState(readSession);
  const scenes = useMemo(
    () => [
      ...(scenario.analysis?.scenes.map((s) => ({
        id: `analysis:${scenario.title}:${s.number}:${s.heading}`,
        number: String(s.number),
        heading: s.heading,
        text: [s.heading, s.location, s.summary, ...s.technical_requirements].join('\n').slice(0, 6000),
        setting: s.setting,
        moment: s.time_of_day,
        source: scenario.analysis?.simulated ? 'Exemple simulé' : 'Analyse courante',
      })) ?? []),
      ...(project.data?.scenes.map((s) => ({
        id: `project:${project.data!.id}:${s.id}`,
        number: s.number,
        heading: s.title,
        text: [s.title, s.summary].join('\n').slice(0, 6000),
        setting: s.setting,
        moment: ({ jour: 'DAY', nuit: 'NIGHT', aube: 'DAWN', heure_doree: 'DUSK' } as const)[s.moment],
        source: 'Projet courant',
      })) ?? []),
    ],
    [project.data, scenario],
  );
  const [sceneId, setSceneId] = useState('');
  const scene = scenes.find((s) => s.id === sceneId);
  const [region, setRegion] = useState('');
  const [date, setDate] = useState(today);
  const [category, setCategory] = useState<Category>('cafe');
  const [radius, setRadius] = useState(10);
  const [requirements, setRequirements] = useState<Requirements>(DEFAULT_REQUIREMENTS);
  const [selectedId, setSelectedId] = useState('');
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [selection, setSelection] = useState<{ location_id: string; slot: Slot; timezone: string } | null>(
    null,
  );
  const [acknowledged, setAcknowledged] = useState(false);
  const [choices, setChoices] = useState(readChoices);
  const [error, setError] = useState('');
  const search = useMutation({ mutationFn: searchLocations, retry: false });
  const semantic = useMutation({ mutationFn: interpretScene, retry: false });
  const evaluation = useMutation({ mutationFn: evaluateLocations, retry: false });
  const [explain, setExplain] = useState(false);
  const selected = search.data?.candidates.find((p) => p.id === selectedId);
  const weather = useQuery({
    queryKey: ['scouting-weather', selectedId, date],
    queryFn: () => getLocationWeather(selectedId, date),
    enabled: !!selected && !!date,
    staleTime: 600_000,
    retry: false,
  });
  const busy = search.isPending || semantic.isPending || evaluation.isPending;
  const clearEvaluation = () => {
    evaluation.reset();
    setSelection(null);
    setAcknowledged(false);
    setError('');
  };
  const center = useMemo<[number, number]>(
    () => [search.data?.center_lat ?? 0, search.data?.center_lon ?? 0],
    [search.data],
  );
  const validRequirements = requirementsSchema.safeParse(requirements);

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        eyebrow="Encadré · Planner"
        title="Repérage · Lieux & météo"
        lead="Un décor réel, des prévisions sourcées et le dernier mot pour toi."
      />
      <p className="border-2 border-ink bg-gold-soft p-4 text-meta">
        Les coordonnées viennent du fournisseur de lieux ; les prévisions viennent d’Open-Meteo. Les horaires
        proposés évaluent la météo et la lumière : ils ne prouvent ni la disponibilité du lieu, ni une
        autorisation de tournage.
      </p>
      <form
        className="grid gap-5 md:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          setError('');
          if (!scene || region.trim().length < 2 || !date) {
            setError('Sélectionne une scène, indique une région et une date.');
            return;
          }
          clearEvaluation();
          setSelectedId('');
          setCompareIds([]);
          search.reset();
          search.mutate({ region: region.trim(), category, radius_km: radius });
        }}
      >
        <Field label="Scène à repérer">
          <Select
            disabled={busy}
            value={sceneId}
            onChange={(e) => {
              const next = scenes.find((s) => s.id === e.target.value);
              setSceneId(e.target.value);
              if (next) setRequirements((r) => ({ ...r, setting: next.setting, moment: next.moment }));
              clearEvaluation();
              semantic.reset();
              search.reset();
              setSelectedId('');
              setCompareIds([]);
            }}
          >
            <option value="">Choisir une scène</option>
            {scenes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.source} · {s.number}. {s.heading}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="Région de recherche"
          hint="Précise ville et pays. Recherche dans le rayon autour du centre géocodé."
        >
          <Input
            placeholder="Tunis, Tunisie"
            maxLength={200}
            disabled={busy}
            value={region}
            onChange={(e) => {
              setRegion(e.target.value);
              search.reset();
              clearEvaluation();
              setSelectedId('');
              setCompareIds([]);
            }}
          />
        </Field>
        <Field label="Date de tournage">
          <Input
            type="date"
            disabled={busy}
            required
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              clearEvaluation();
            }}
          />
        </Field>
        <Field label="Rayon de recherche (km)">
          <Input
            type="number"
            min={1}
            max={30}
            required
            value={radius}
            disabled={busy}
            onChange={(e) => {
              setRadius(Number(e.target.value));
              search.reset();
              clearEvaluation();
              setSelectedId('');
              setCompareIds([]);
            }}
          />
        </Field>
        <Field label="Type de décor recherché">
          <Select
            value={category}
            disabled={busy}
            onChange={(e) => {
              setCategory(e.target.value as Category);
              search.reset();
              clearEvaluation();
              setSelectedId('');
              setCompareIds([]);
            }}
          >
            {Object.entries(categories).map(([v, label]) => (
              <option value={v} key={v}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <div className="flex flex-wrap items-end gap-3">
          <Button type="submit" loading={search.isPending} disabled={busy}>
            Rechercher des lieux réels
          </Button>
          <Button
            variant="secondary"
            loading={semantic.isPending}
            disabled={!scene || busy}
            onClick={() => {
              clearEvaluation();
              semantic.mutate(scene!.text, {
                onSuccess: (r) => {
                  setCategory(r.category);
                  search.reset();
                  setSelectedId('');
                  setCompareIds([]);
                },
              });
            }}
          >
            Interpréter les besoins avec Ollama
          </Button>
        </div>
      </form>
      {!scenes.length && (
        <p>
          Aucune scène disponible.{' '}
          <ButtonLink to="/planner/scenario" variant="secondary">
            Analyser un scénario
          </ButtonLink>
        </p>
      )}
      {project.isError && (
        <p role="alert">
          Le projet n’a pas pu être chargé : {message(project.error)}. Les scènes de l’analyse courante
          restent utilisables.
        </p>
      )}
      {scene && (
        <p className="whitespace-pre-line border-l-4 border-gold pl-4 text-meta">
          {scene.source} · {scene.text}
        </p>
      )}
      {semantic.data && (
        <div role="status" className="border-2 border-ink bg-white p-4">
          <strong>Brouillon Ollama : à valider</strong>
          <p>{semantic.data.explanation}</p>
          <p>Mots-clés : {semantic.data.keywords.join(', ')}</p>
          <p>
            Catégorie proposée : {categories[semantic.data.category]}. Modifie-la si nécessaire avant la
            recherche.
          </p>
        </div>
      )}
      <details className="border-2 border-ink p-4" open>
        <summary className="min-h-11 cursor-pointer font-semibold">
          Critères de tournage modifiables · règles déterministes
        </summary>
        <p className="my-3 text-meta">
          Seuils de départ de l’application, à adapter à ton équipe et ton matériel. Aucun seuil n’est extrait
          comme un fait par l’IA. Le score mesure uniquement la compatibilité avec ces critères.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Intérieur / extérieur">
            <Select
              value={requirements.setting}
              disabled={busy}
              onChange={(e) => {
                setRequirements({ ...requirements, setting: e.target.value as Requirements['setting'] });
                clearEvaluation();
              }}
            >
              {['INT', 'EXT', 'UNKNOWN'].map((v) => (
                <option key={v} value={v}>
                  {v === 'UNKNOWN' ? 'À préciser' : v}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Moment recherché">
            <Select
              disabled={busy}
              value={requirements.moment}
              onChange={(e) => {
                setRequirements({ ...requirements, moment: e.target.value as Requirements['moment'] });
                clearEvaluation();
              }}
            >
              {Object.entries(moments).map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          {Object.entries(thresholds).map(([key, label]) => (
            <Field key={key} label={label}>
              <Input
                type="number"
                step="any"
                disabled={busy}
                value={
                  Number.isFinite(requirements[key as keyof typeof thresholds])
                    ? requirements[key as keyof typeof thresholds]
                    : ''
                }
                onChange={(e) => {
                  setRequirements({
                    ...requirements,
                    [key]: e.target.value === '' ? Number.NaN : Number(e.target.value),
                  });
                  clearEvaluation();
                }}
              />
            </Field>
          ))}
        </div>
        {!validRequirements.success && (
          <p role="alert">
            Vérifie les seuils : vent 0–200, pluie 0–100, nuages 0–100 %, température −60 à 60 °C et minimum ≤
            maximum.
          </p>
        )}
      </details>
      {error && (
        <p role="alert" className="bg-bad-bg p-4">
          {error}
        </p>
      )}
      {[search, semantic, evaluation].map((m, i) =>
        m.isError ? (
          <p key={i} role="alert" className="border-2 border-bad-fg p-4">
            {message(m.error)}
          </p>
        ) : null,
      )}
      {search.isPending && <p role="status">Recherche de lieux réels en cours…</p>}
      {search.data && (
        <>
          <p role="status">
            {search.data.candidates.length} lieu(x) · {search.data.region} · rayon {search.data.radius_km} km.{' '}
            {categories[search.data.category]}.
          </p>
          {!search.data.candidates.length && (
            <p>Aucun lieu trouvé pour ce type de décor. Modifie le rayon, la catégorie ou la région.</p>
          )}
          <div className="grid items-start gap-5 lg:grid-cols-[1.3fr_1fr]">
            <ScoutingMap
              candidates={search.data.candidates}
              center={center}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
            <section aria-label="Lieux candidats" className="grid max-h-[600px] gap-3 overflow-auto">
              {search.data.candidates.map((place) => (
                <article
                  key={place.id}
                  className={`border-2 bg-white p-4 ${selectedId === place.id ? 'border-action' : 'border-ink'}`}
                >
                  <h2 className="text-h3">{place.name}</h2>
                  <p className="text-meta">{place.address || 'Adresse non renseignée'}</p>
                  <p className="text-meta">
                    GPS {place.lat.toFixed(5)}, {place.lon.toFixed(5)} · {place.categories.join(', ')}
                  </p>
                  <p className="text-meta">Disponibilité de tournage : non vérifiée.</p>
                  <div className="mt-3 flex flex-wrap items-center gap-4">
                    <Button
                      size="sm"
                      variant="secondary"
                      aria-pressed={selectedId === place.id}
                      onClick={() => setSelectedId(place.id)}
                    >
                      Voir la météo de {place.name}
                    </Button>
                    <label className="flex min-h-11 items-center gap-2 text-meta">
                      <input
                        type="checkbox"
                        checked={compareIds.includes(place.id)}
                        disabled={(!compareIds.includes(place.id) && compareIds.length >= 3) || busy}
                        onChange={(e) => {
                          setCompareIds((ids) =>
                            e.target.checked ? [...ids, place.id] : ids.filter((id) => id !== place.id),
                          );
                          clearEvaluation();
                        }}
                      />
                      Comparer {place.name}
                    </label>
                  </div>
                </article>
              ))}
            </section>
          </div>
          <p className="text-meta">
            <a className="underline" href="https://www.geoapify.com/">
              Powered by Geoapify
            </a>{' '}
            · ©{' '}
            <a className="underline" href="https://www.openstreetmap.org/copyright">
              OpenStreetMap contributors
            </a>{' '}
            (ODbL). Résultats récupérés le{' '}
            {search.data.candidates[0]
              ? new Date(search.data.candidates[0].fetched_at).toLocaleString('fr-FR')
              : '—'}
            .
          </p>
        </>
      )}
      {selected && weather.isPending && (
        <p role="status">Chargement automatique de la météo aux coordonnées de {selected.name}…</p>
      )}
      {selected && weather.isError && (
        <div role="alert">
          {message(weather.error)}{' '}
          <Button variant="secondary" onClick={() => void weather.refetch()}>
            Réessayer la météo
          </Button>
        </div>
      )}
      {selected && weather.data && <WeatherPanel place={selected} weather={weather.data} />}
      {!!search.data?.candidates.length && (
        <section className="flex flex-col gap-4 border-2 border-ink p-5">
          <h2 className="text-h2">Comparer les créneaux de tournage</h2>
          <p>
            Coche jusqu’à trois lieux. Chaque créneau dure une heure. « Compatible » concerne les critères
            météo et lumière, pas la réservation.
          </p>
          <label className="flex min-h-11 items-center gap-2">
            <input
              type="checkbox"
              disabled={busy}
              checked={explain}
              onChange={(e) => {
                setExplain(e.target.checked);
                clearEvaluation();
              }}
            />
            Ajouter une explication Ollama (brouillon, peut prendre du temps)
          </label>
          <Button
            disabled={!compareIds.length || !validRequirements.success || !scene || !date || busy}
            loading={evaluation.isPending}
            onClick={() => {
              setSelection(null);
              setAcknowledged(false);
              setError('');
              evaluation.mutate({
                location_ids: compareIds,
                date,
                requirements,
                scene_text: scene!.text,
                explain_with_ollama: explain,
              });
            }}
          >
            Comparer {compareIds.length} lieu(x)
          </Button>
          {evaluation.isPending && <p role="status">Comparaison des prévisions selon tes critères…</p>}
          <div className="grid gap-4 lg:grid-cols-3">
            {evaluation.data?.map((result) => {
              const ranked = [...result.slots].sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
              const best = ranked.find((s) => s.score !== null);
              return (
                <article key={result.location.id} className="min-w-0 border-2 border-ink bg-white p-4">
                  <h3 className="text-h3">{result.location.name}</h3>
                  {result.weather.status === 'unavailable' && (
                    <p>Prévision indisponible : {result.weather.reason}</p>
                  )}
                  {best ? (
                    <p className="my-3 font-semibold">
                      Meilleure compatibilité : {best.score}/100 ·{' '}
                      {localTime(best.start, result.weather.timezone)}–
                      {localTime(best.end, result.weather.timezone)} · {result.weather.timezone}
                    </p>
                  ) : (
                    <p>Aucun créneau évaluable.</p>
                  )}
                  {ranked.slice(0, 3).map((slot) => (
                    <div key={slot.start} className="my-3 border-t border-line-light pt-3">
                      <p className="font-semibold">
                        {localTime(slot.start, result.weather.timezone)}–
                        {localTime(slot.end, result.weather.timezone)} · {labels[slot.verdict]}{' '}
                        {slot.score === null ? '' : `(${slot.score}/100)`}
                      </p>
                      <p className="text-meta">
                        {slot.weather.temperature_c ?? '—'} °C · vent {slot.weather.wind_kmh ?? '—'} km/h ·
                        pluie {slot.weather.precipitation_mm ?? '—'} mm · nuages{' '}
                        {slot.weather.cloud_pct ?? '—'} %
                      </p>
                      <ul className="my-2 list-disc pl-5 text-meta">
                        {slot.reasons.map((r) => (
                          <li key={r}>{r}</li>
                        ))}
                      </ul>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={slot.verdict === 'unavailable'}
                        onClick={() => {
                          setSelection({
                            location_id: result.location.id,
                            slot,
                            timezone: result.weather.timezone,
                          });
                          setAcknowledged(false);
                        }}
                      >
                        Choisir ce créneau · {result.location.name} ·{' '}
                        {localTime(slot.start, result.weather.timezone)}
                      </Button>
                    </div>
                  ))}
                  {!!result.slots.length && (
                    <Field label={`Autre créneau · ${result.location.name}`}>
                      <Select
                        value={selection?.location_id === result.location.id ? selection.slot.start : ''}
                        onChange={(e) => {
                          const slot = result.slots.find((s) => s.start === e.target.value);
                          if (slot) {
                            setSelection({
                              location_id: result.location.id,
                              slot,
                              timezone: result.weather.timezone,
                            });
                            setAcknowledged(false);
                          }
                        }}
                      >
                        <option value="">Choisir une autre heure</option>
                        {result.slots
                          .filter((s) => s.verdict !== 'unavailable')
                          .map((s) => (
                            <option key={s.start} value={s.start}>
                              {localTime(s.start, result.weather.timezone)}–
                              {localTime(s.end, result.weather.timezone)} · {s.score}/100
                            </option>
                          ))}
                      </Select>
                    </Field>
                  )}
                  {result.ai_status === 'available' && (
                    <p className="mt-4 border-l-4 border-gold pl-3 text-meta">
                      Brouillon Ollama : à valider. {result.ai_explanation}
                    </p>
                  )}
                  {result.ai_status === 'unavailable' && (
                    <p className="mt-4 text-meta">
                      Explication Ollama indisponible. Les verdicts ci-dessus proviennent exclusivement des
                      règles déterministes.
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      )}
      {selection && (
        <section className="flex flex-col gap-3 border-2 border-ink bg-gold-soft p-5">
          <h2 className="text-h2">Validation humaine</h2>
          <p>
            {evaluation.data?.find((r) => r.location.id === selection.location_id)?.location.name} · {date} ·{' '}
            {localTime(selection.slot.start, selection.timezone)}–
            {localTime(selection.slot.end, selection.timezone)} ({selection.timezone}).
          </p>
          <ul className="list-disc pl-5">
            {selection.slot.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          <label className="flex min-h-11 items-center gap-2">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
            />
            J’ai revu ces critères. Accès, sécurité et autorisations restent à vérifier avec le lieu.
          </label>
          <Button
            disabled={!acknowledged || !scene}
            onClick={() => {
              const location = evaluation.data?.find(
                (r) => r.location.id === selection.location_id,
              )?.location;
              if (!location || !scene) return;
              try {
                const choice: ScoutChoice = {
                  scene_id: scene.id,
                  scene_number: scene.number,
                  scene_heading: scene.heading,
                  date,
                  location,
                  slot: selection.slot,
                  timezone: selection.timezone,
                  requirements,
                  confirmed_at: new Date().toISOString(),
                };
                saveChoice(choice);
                setChoices(readChoices());
                setSelection(null);
                setAcknowledged(false);
              } catch {
                setError('Stockage de session indisponible. Le choix n’a pas été enregistré.');
              }
            }}
          >
            Confirmer ce lieu et cette heure
          </Button>
        </section>
      )}
      {!!choices.length && (
        <section className="flex flex-col gap-3 border-2 border-ink p-5">
          <h2 className="text-h2">Repérages confirmés · session de cet onglet</h2>
          {choices.map((c) => (
            <div key={c.scene_id} className="border-t border-line-light py-3">
              <p>
                {c.scene_number}. {c.scene_heading} → {c.location.name} · {c.date} ·{' '}
                {localTime(c.slot.start, c.timezone)}–{localTime(c.slot.end, c.timezone)} ({c.timezone})
              </p>
              <Button
                variant="ghost"
                onClick={() => {
                  try {
                    const next = choices.filter((x) => x.scene_id !== c.scene_id);
                    sessionStorage.setItem(SCOUTING_KEY, JSON.stringify(next));
                    setChoices(next);
                  } catch {
                    setError('Impossible de supprimer ce choix du stockage.');
                  }
                }}
              >
                Retirer ce choix · {c.location.name}
              </Button>
            </div>
          ))}
          <p className="text-meta">
            Pour modifier un choix, recherche et confirme un autre lieu ou créneau pour la même scène. Le
            nouveau choix remplace le précédent.
          </p>
          <ButtonLink to="/planner/projet?etape=3" variant="secondary">
            Appliquer les repérages au projet
          </ButtonLink>
        </section>
      )}
      <p className="text-meta">
        Le scénario n’est pas envoyé aux services cartographiques ou météo. Ollama reçoit uniquement la
        description de scène lorsque tu demandes une interprétation ou une explication. Les choix sont gardés
        dans la session de cet onglet ; ils ne sont transférés au projet qu’à ta demande.
      </p>
      <p className="text-meta">
        Prévisions :{' '}
        <a className="underline" href="https://open-meteo.com/">
          Open-Meteo
        </a>{' '}
        (CC BY 4.0). Pas de prévision disponible hors horizon, ni garantie de conditions réelles le jour du
        tournage.
      </p>
    </div>
  );
}
