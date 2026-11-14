import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api';
import { clearProjectCache } from '@/features/festival/lib/localStore';

/** Rassemble tout ce qui concerne le projet en un seul fichier JSON. */
export function useExportData() {
  return useMutation({
    mutationFn: async (projectId: string) => {
      const [project, passport, subtitles] = await Promise.all([
        api.getProject(projectId),
        api.getProjectPassport(projectId),
        api.getSubtitleDraft(projectId),
      ]);
      return {
        format: 'premier-plan-export',
        version: 1,
        exported_at: new Date().toISOString(),
        project,
        passport,
        subtitles,
      };
    },
  });
}

export function useDeleteProjectData() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (projectId: string) => api.deleteProject(projectId),
    onSuccess: (_r, projectId) => {
      clearProjectCache(projectId);
      try {
        sessionStorage.removeItem(`pp-ia-detected-${projectId}`);
      } catch {
        /* rien */
      }
      qc.clear();
    },
  });
}
