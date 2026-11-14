import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type C2paSignInput, type Passport, type SavePassportInput } from '@/api';

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

export function usePassportPdf() {
  return useMutation({ mutationFn: (id: string) => api.getPassportPdfUrl(id) });
}

export function useSignC2pa(projectId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: C2paSignInput) => api.signC2pa(input),
    onSuccess: (_r, input) => {
      if (projectId) void qc.invalidateQueries({ queryKey: passportKeys.ofProject(projectId) });
      void qc.invalidateQueries({ queryKey: passportKeys.verify(input.passport_id) });
    },
  });
}

export function useVerifyPassport(id: string | undefined) {
  return useQuery({
    queryKey: passportKeys.verify(id ?? 'aucun'),
    queryFn: () => api.verifyPassport(id!),
    enabled: !!id,
  });
}
