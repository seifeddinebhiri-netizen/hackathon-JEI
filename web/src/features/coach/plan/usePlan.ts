import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '@/api';
import type { ShotSpec, ShotSpecRequest } from '@/api/types';
import { loadCalibration, saveCalibration } from './store';

/** Tables mots → nombres : téléchargées une fois, puis gardées dans le téléphone (hors ligne). */
export function useCalibration() {
  return useQuery({
    queryKey: ['coach', 'calibration'],
    queryFn: async () => {
      const cal = await api.getCalibration();
      saveCalibration(cal);
      return cal;
    },
    placeholderData: () => loadCalibration() ?? undefined,
    staleTime: 24 * 60 * 60 * 1000,
    retry: false,
  });
}

/**
 * Demande un plan de prise de vue à l'IA pour la scène d'un espace de travail.
 * `onSuccess` est dans les options du hook : il s'exécute même si l'utilisateur a changé d'espace
 * pendant l'attente, le plan arrive alors dans le bon espace. `mutationKey` permet à l'onglet de
 * l'espace d'afficher « génération… ».
 */
export function useGeneratePlan(
  workspaceId: string,
  onSuccess: (spec: ShotSpec, request: ShotSpecRequest) => void,
) {
  return useMutation({
    mutationKey: ['coach', 'generate', workspaceId],
    mutationFn: (input: ShotSpecRequest) => api.generateShotSpec(input),
    onSuccess: (spec, request) => onSuccess(spec, request),
  });
}
