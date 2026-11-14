/**
 * Champs du Kit Festival enregistrés dans le projet (film_profile, synopsis, film_page) via
 * PATCH /projects/{id}. Le navigateur garde une copie (même forme) qui sert de CACHE :
 * affichage immédiat, et filet de sécurité si l'enregistrement échoue.
 */
import { useCallback, useState } from 'react';
import type { FilmPageContent, Project, ProjectFilmProfile, SynopsisTexts } from '@/api/types';
import { useAutosave } from '@/features/planner/hooks/useAutosave';
import { useOptimisticProjectUpdate } from '@/features/planner/hooks/usePlanner';

type SyncedField = 'film_profile' | 'synopsis' | 'film_page';
type FieldValue<K extends SyncedField> = NonNullable<Project[K]>;

const cacheKey = (field: SyncedField, projectId: string) => `pp-cache-${field}-${projectId}`;

export function readCache<T>(field: SyncedField, projectId: string): T | undefined {
  try {
    const raw = localStorage.getItem(cacheKey(field, projectId));
    return raw ? (JSON.parse(raw) as T) : undefined;
  } catch {
    return undefined;
  }
}

function writeCache(field: SyncedField, projectId: string, value: unknown): void {
  try {
    localStorage.setItem(cacheKey(field, projectId), JSON.stringify(value));
  } catch {
    /* stockage indisponible */
  }
}

export function clearProjectCache(projectId: string): void {
  for (const f of ['film_profile', 'synopsis', 'film_page'] as const) {
    try {
      localStorage.removeItem(cacheKey(f, projectId));
    } catch {
      /* rien */
    }
  }
}

/** Valeur actuelle d'un champ (projet → cache → défaut), en lecture seule. */
export function projectField<K extends SyncedField>(
  project: Project,
  field: K,
  fallback: FieldValue<K>,
): FieldValue<K> {
  return (
    (project[field] as FieldValue<K> | undefined) ?? readCache<FieldValue<K>>(field, project.id) ?? fallback
  );
}

/** Champ modifiable, enregistré automatiquement dans le projet. */
export function useProjectField<K extends SyncedField>(project: Project, field: K, fallback: FieldValue<K>) {
  const [value, setValue] = useState<FieldValue<K>>(() => projectField(project, field, fallback));
  const update = useOptimisticProjectUpdate(project.id);
  const autosave = useAutosave(value, (v) => update.mutateAsync({ [field]: v }));
  const set = useCallback(
    (next: FieldValue<K> | ((v: FieldValue<K>) => FieldValue<K>)) =>
      setValue((prev) => {
        const v = typeof next === 'function' ? (next as (v: FieldValue<K>) => FieldValue<K>)(prev) : next;
        writeCache(field, project.id, v);
        return v;
      }),
    [field, project.id],
  );
  return [value, set, autosave.state] as const;
}

export const EMPTY_SYNOPSIS: SynopsisTexts = { phrase: '', court: '', long: '' };
export const EMPTY_FILM_PAGE: FilmPageContent = {
  stills: ['/photos/ruelle.jpg', '/photos/porte.jpg', '/photos/cote.jpg'],
};
export function defaultProfile(format: 'court' | 'long'): ProjectFilmProfile {
  return { duration_min: format === 'court' ? 15 : 90, language: 'Derja (arabe tunisien)', genre: 'Fiction' };
}
