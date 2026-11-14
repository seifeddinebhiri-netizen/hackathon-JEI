import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { api, type Project, type QuickSlotRequest, type Schedule, type UpdateProjectInput } from '@/api';
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

export function useGeocode() {
  return useMutation({ mutationFn: (q: string) => api.geocode(q) });
}
