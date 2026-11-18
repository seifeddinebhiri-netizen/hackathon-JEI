import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  api,
  isApiError,
  type CreateSubtitleDraftInput,
  type Festival,
  type FestivalSearchParams,
  type Project,
  type ShortlistItem,
  type SubtitleDraft,
  type SubtitleLine,
  type SynopsisFeedbackInput,
  type SynopsisTranslateInput,
} from '@/api';
import { useOptimisticProjectUpdate } from '@/features/planner/hooks/usePlanner';
import { projectKeys } from '@/features/project/hooks/useProject';

export const festivalKeys = {
  search: (p: FestivalSearchParams) => ['festivals', 'search', p] as const,
  one: (id: string) => ['festivals', 'one', id] as const,
};

export function useFestivalSearch(params: FestivalSearchParams, enabled = true) {
  return useQuery({
    queryKey: festivalKeys.search(params),
    queryFn: () => api.searchFestivals(params),
    enabled,
    staleTime: 5 * 60_000,
    placeholderData: (prev) => prev,
  });
}

export function useFestival(id: string | undefined) {
  return useQuery({
    queryKey: festivalKeys.one(id ?? 'aucun'),
    queryFn: () => api.getFestival(id!),
    enabled: !!id,
    staleTime: 5 * 60_000,
  });
}

/**
 * Festivals de la sélection du projet, chargés un par un (même cache que la fiche).
 * Un festival retiré du catalogue (404) est listé dans `missing` au lieu de tout faire échouer.
 */
export function useShortlistFestivals(ids: string[]) {
  const qc = useQueryClient();
  return useQuery({
    queryKey: ['festivals', 'shortlist', ids],
    queryFn: async () => {
      const results = await Promise.all(
        ids.map((id) =>
          qc
            .fetchQuery({
              queryKey: festivalKeys.one(id),
              queryFn: () => api.getFestival(id),
              staleTime: 5 * 60_000,
            })
            .catch((e: unknown) => {
              if (isApiError(e) && e.status === 404) return id;
              throw e;
            }),
        ),
      );
      return {
        festivals: results.filter((r): r is Festival => typeof r !== 'string'),
        missing: results.filter((r): r is string => typeof r === 'string'),
      };
    },
    staleTime: 5 * 60_000,
  });
}

/** Sélection de festivals du projet (« Mes dossiers »), enregistrée avec PATCH /projects. */
export function useShortlist(project: Project) {
  const update = useOptimisticProjectUpdate(project.id);
  const qc = useQueryClient();
  const current = () =>
    qc.getQueryData<Project>(projectKeys.one(project.id))?.festival_shortlist ?? project.festival_shortlist;
  const save = (next: ShortlistItem[]) => update.mutateAsync({ festival_shortlist: next });
  return {
    pending: update.isPending,
    error: update.error,
    add: (item: ShortlistItem) =>
      current().some((s) => s.festival_id === item.festival_id)
        ? Promise.resolve()
        : save([...current(), item]),
    remove: (festivalId: string) => save(current().filter((s) => s.festival_id !== festivalId)),
    replace: (item: ShortlistItem) =>
      save(current().map((s) => (s.festival_id === item.festival_id ? item : s))),
  };
}

export const subtitleKeys = { draft: (projectId: string) => ['subtitles', projectId] as const };

export function useSubtitleDraft(projectId: string | undefined) {
  return useQuery({
    queryKey: subtitleKeys.draft(projectId ?? 'aucun'),
    queryFn: () => api.getSubtitleDraft(projectId!),
    enabled: !!projectId,
  });
}

export function useCreateSubtitleDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSubtitleDraftInput) => api.createSubtitleDraft(input),
    onSuccess: (d) => qc.setQueryData(subtitleKeys.draft(d.project_id), d),
  });
}

export function useSaveSubtitles(projectId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (lines: SubtitleLine[]) => api.saveSubtitles(projectId!, lines),
    onMutate: (lines) => {
      const k = subtitleKeys.draft(projectId!);
      const prev = qc.getQueryData<SubtitleDraft>(k);
      if (prev) qc.setQueryData<SubtitleDraft>(k, { ...prev, lines });
      return { prev };
    },
    onError: (_e, _l, ctx) => ctx?.prev && qc.setQueryData(subtitleKeys.draft(projectId!), ctx.prev),
    onSuccess: (d) => qc.setQueryData(subtitleKeys.draft(projectId!), d),
  });
}

export function useSynopsisFeedback() {
  return useMutation({ mutationFn: (input: SynopsisFeedbackInput) => api.getSynopsisFeedback(input) });
}

export function useTranslateSynopsis() {
  return useMutation({ mutationFn: (input: SynopsisTranslateInput) => api.translateSynopsis(input) });
}

export function usePublicFilm(id: string | undefined) {
  return useQuery({ queryKey: ['film', id], queryFn: () => api.getPublicFilm(id!), enabled: !!id });
}
