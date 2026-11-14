import { useQuery } from '@tanstack/react-query';
import { api, type FestivalSearchParams } from '@/api';

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
