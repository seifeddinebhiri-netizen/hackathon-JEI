import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import {
  api,
  type LocationSuggestInput,
  type LocationSuggestResult,
  type Project,
  type QuickSlotRequest,
  type Schedule,
  type SceneSuggestInput,
  type SceneSuggestResult,
  type UpdateProjectInput,
} from '@/api';
import { projectKeys } from '@/features/project/hooks/useProject';
import type { WeatherByDate } from '../lib/schedule';

export const plannerKeys = {
  geocode: (q: string) => ['geocode', q] as const,
  weather: (lat: number, lon: number, from: string, to: string) => ['weather', lat, lon, from, to] as const,
};

/** Coordonnées de la ville du projet (première réponse du géocodage). */
export function useCityCoords(city: string | undefined) {
  return useQuery({
    queryKey: plannerKeys.geocode(city ?? ''),
    queryFn: () => api.geocode(city!),
    enabled: !!city,
    staleTime: Infinity,
    select: (r) => r[0],
  });
}

/** Météo de toute la période de tournage (pour afficher les conflits même sur les jours vides). */
export function usePeriodWeather(project: Project | undefined) {
  const coords = useCityCoords(project?.city);
  const from = project?.shooting_window.from ?? '';
  const to = project?.shooting_window.to ?? '';
  const q = useQuery({
    queryKey: plannerKeys.weather(coords.data?.lat ?? 0, coords.data?.lon ?? 0, from, to),
    queryFn: () => api.getWeather({ lat: coords.data!.lat, lon: coords.data!.lon, from, to }),
    enabled: !!coords.data && !!from && !!to,
    staleTime: 10 * 60_000,
  });
  const byDate = useMemo<WeatherByDate>(() => new Map((q.data ?? []).map((w) => [w.date, w])), [q.data]);
  return { ...q, byDate, isPending: coords.isPending || q.isPending };
}

/**
 * Mise à jour optimiste du projet (planning, scènes…). En cas d'échec, on revient en arrière.
 */
export function useOptimisticProjectUpdate(projectId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: UpdateProjectInput) => api.updateProject(projectId!, patch),
    onMutate: async (patch) => {
      const key = projectKeys.one(projectId!);
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<Project>(key);
      if (previous) qc.setQueryData<Project>(key, { ...previous, ...patch });
      return { previous };
    },
    onError: (_e, _patch, ctx) => {
      if (ctx?.previous) qc.setQueryData(projectKeys.one(projectId!), ctx.previous);
    },
    onSuccess: (p) => qc.setQueryData(projectKeys.one(p.id), p),
  });
}

/** Génère un planning (brouillon IA) puis l'enregistre dans le projet. */
export function useGenerateSchedule(projectId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<{ schedule: Schedule; previous?: Schedule }> => {
      const previous = qc.getQueryData<Project>(projectKeys.one(projectId!))?.schedule;
      const schedule = await api.generateSchedule({ project_id: projectId! });
      const p = await api.updateProject(projectId!, { schedule });
      qc.setQueryData(projectKeys.one(p.id), p);
      return { schedule, previous };
    },
  });
}

export function useParseScreenplay() {
  return useMutation({ mutationFn: api.parseScreenplay });
}

export function useQuickSlots() {
  return useMutation({ mutationFn: (req: QuickSlotRequest) => api.quickSlots(req) });
}

/** Empreinte stable des données envoyées (scènes du décor, contexte, exclusions). */
export function locationSuggestKey(input: LocationSuggestInput): string {
  const s = JSON.stringify(input);
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/** Dernière proposition par décor, avec l'empreinte des scènes qui l'ont produite (durée de la session). */
const suggestionCache = new Map<string, { key: string; result: LocationSuggestResult }>();

/** Proposition déjà obtenue pour ce décor et ces mêmes scènes, sinon undefined. */
export function cachedLocationSuggestion(
  decorId: string,
  input: LocationSuggestInput,
): LocationSuggestResult | undefined {
  const hit = suggestionCache.get(decorId);
  return hit && hit.key === locationSuggestKey(input) ? hit.result : undefined;
}

/**
 * Lieux proposés par l'IA pour un décor. Mise en cache par décor : tant que les scènes du décor
 * (et le contexte envoyé) n'ont pas changé, on ne relance pas l'appel.
 */
export function useSuggestLocations() {
  return useMutation({
    mutationFn: async ({ decorId, input }: { decorId: string; input: LocationSuggestInput }) => {
      const cached = cachedLocationSuggestion(decorId, input);
      if (cached) return cached;
      const result = await api.suggestLocations(input);
      suggestionCache.set(decorId, { key: locationSuggestKey(input), result });
      return result;
    },
  });
}

/** Empreinte stable de n'importe quelle donnée envoyée (même algorithme que les lieux). */
const fingerprint = (x: unknown) => locationSuggestKey(x as LocationSuggestInput);

export type SuggestionDecision = 'acceptee' | 'refusee';
type SceneSuggestEntry = {
  key: string;
  result: SceneSuggestResult;
  decisions: Record<string, SuggestionDecision>;
};
/** Dernières suggestions de tournage par projet, avec les décisions de l'auteur (durée de la session). */
const sceneSuggestCache = new Map<string, SceneSuggestEntry>();

/** Dernières suggestions du projet ; `stale` si les scènes ont changé depuis. */
export function cachedSceneSuggestions(
  projectId: string,
  input: SceneSuggestInput,
): (SceneSuggestEntry & { stale: boolean }) | undefined {
  const hit = sceneSuggestCache.get(projectId);
  return hit ? { ...hit, stale: hit.key !== fingerprint(input) } : undefined;
}

export function saveSuggestionDecision(projectId: string, id: string, decision: SuggestionDecision) {
  const hit = sceneSuggestCache.get(projectId);
  if (hit) hit.decisions = { ...hit.decisions, [id]: decision };
}

/** Suggestions de tournage sur les scènes : pas de nouvel appel si les scènes n'ont pas changé. */
export function useSuggestScenes() {
  return useMutation({
    mutationFn: async ({ projectId, input }: { projectId: string; input: SceneSuggestInput }) => {
      const hit = sceneSuggestCache.get(projectId);
      const key = fingerprint(input);
      if (hit && hit.key === key) return hit.result;
      const result = await api.suggestScenes(input);
      sceneSuggestCache.set(projectId, { key, result, decisions: {} });
      return result;
    },
  });
}

/** Météo jour par jour d'un lieu localisé, sur la période de tournage. */
export function useLocationWeather(
  lat: number | undefined,
  lon: number | undefined,
  from: string,
  to: string,
) {
  return useQuery({
    queryKey: plannerKeys.weather(lat ?? 0, lon ?? 0, from, to),
    queryFn: () => api.getWeather({ lat: lat!, lon: lon!, from, to }),
    enabled: lat !== undefined && lon !== undefined && !!from && !!to,
    staleTime: 10 * 60_000,
  });
}

export function useGeocode() {
  return useMutation({ mutationFn: (q: string) => api.geocode(q) });
}
