import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type CreateProjectInput, type Project, type UpdateProjectInput } from '@/api';
import { useAuth } from '@/features/auth/hooks/useAuth';

export const projectKeys = {
  all: ['projects'] as const,
  one: (id: string) => ['projects', id] as const,
};

/** Identifiant du projet courant de l'utilisateur connecté. */
export function useCurrentProjectId(): string | undefined {
  return useAuth().user?.project_id;
}

export function useProject(id: string | undefined) {
  return useQuery({
    queryKey: projectKeys.one(id ?? 'aucun'),
    queryFn: () => api.getProject(id!),
    enabled: !!id,
  });
}

export function useCurrentProject() {
  return useProject(useCurrentProjectId());
}

export function useUpdateProject(id: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: UpdateProjectInput) => api.updateProject(id!, patch),
    onSuccess: (p: Project) => qc.setQueryData(projectKeys.one(p.id), p),
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateProjectInput) => api.createProject(input),
    onSuccess: (p: Project) => qc.setQueryData(projectKeys.one(p.id), p),
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteProject(id),
    onSuccess: (_r, id) => qc.removeQueries({ queryKey: projectKeys.one(id) }),
  });
}
