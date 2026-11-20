import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type AiTool, type Passport, type SavePassportInput } from '@/api';
import { findTool } from '../lib/findTool';

export const passportKeys = {
  ofProject: (projectId: string) => ['passport', 'projet', projectId] as const,
  check: (id: string) => ['passport', id, 'check'] as const,
  verify: (id: string) => ['verify', id] as const,
  tools: ['ai-tools'] as const,
};

export function useProjectPassport(projectId: string | undefined) {
  return useQuery({
    queryKey: passportKeys.ofProject(projectId ?? 'aucun'),
    queryFn: () => api.getProjectPassport(projectId!),
    enabled: !!projectId,
  });
}

export function useAiTools() {
  return useQuery({ queryKey: passportKeys.tools, queryFn: api.getAiTools, staleTime: 60 * 60_000 });
}

export function useSavePassport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SavePassportInput) => api.savePassport(input),
    onSuccess: (p: Passport) => {
      qc.setQueryData(passportKeys.ofProject(p.project_id), p);
      void qc.invalidateQueries({ queryKey: passportKeys.check(p.id) });
      void qc.invalidateQueries({ queryKey: passportKeys.verify(p.id) });
    },
  });
}

export function usePassportCheck(id: string | undefined) {
  return useQuery({
    queryKey: passportKeys.check(id ?? 'aucun'),
    queryFn: () => api.checkPassport(id!),
    enabled: !!id,
  });
}

/**
 * PDF du Passeport. Avec le vrai backend, il est signé (C2PA) et le serveur marque le Passeport
 * « signé » : on relit le Passeport pour afficher cet état.
 */
export function usePassportPdf(projectId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.getPassportPdfUrl(id),
    onSuccess: () => {
      if (projectId) void qc.invalidateQueries({ queryKey: passportKeys.ofProject(projectId) });
    },
  });
}

/** Ajouter un outil absent de la liste : le catalogue, sinon une recherche sur le serveur. */
export function useFindTool() {
  const qc = useQueryClient();
  return useMutation<AiTool, Error, string>({
    mutationFn: (name) => findTool(name),
    onSuccess: () => void qc.invalidateQueries({ queryKey: passportKeys.tools }),
  });
}

/** Vérifier un PDF reçu (page publique) : le serveur le lit puis l'oublie. */
export function useVerifyPdf() {
  return useMutation({ mutationFn: (file: File) => api.verifyPassportPdf(file) });
}

export function useVerifyPassport(id: string | undefined) {
  return useQuery({
    queryKey: passportKeys.verify(id ?? 'aucun'),
    queryFn: () => api.verifyPassport(id!),
    enabled: !!id,
  });
}
