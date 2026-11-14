import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  api,
  type FestivalSearchParams,
  type SubtitleDraft,
  type SubtitleLine,
  type SynopsisFeedbackInput,
} from '@/api';

export const festivalKeys = {
  search: (p: FestivalSearchParams) => ['festivals', p] as const,
};

export function useFestivalSearch(params: FestivalSearchParams, enabled = true) {
  return useQuery({
    queryKey: festivalKeys.search(params),
    queryFn: () => api.searchFestivals(params),
    enabled,
    staleTime: 5 * 60_000,
  });
}

export const subtitleKeys = { draft: (projectId: string) => ['subtitles', projectId] as const };

export function useSubtitleDraft(projectId: string | undefined) {
  return useQuery({
    queryKey: subtitleKeys.draft(projectId ?? 'aucun'),
    queryFn: () => api.getSubtitleDraft(projectId!),
    enabled: !!projectId,
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

export function usePublicFilm(id: string | undefined) {
  return useQuery({ queryKey: ['film', id], queryFn: () => api.getPublicFilm(id!), enabled: !!id });
}
