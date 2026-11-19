/**
 * Champs du film du Kit Festival (film_profile, synopsis, film_page) : lus dans le projet fourni
 * par <WithProject> (qui y place les données du Kit) et enregistrés automatiquement dans la base
 * (table film_kits, ou mocks si VITE_USE_MOCKS=true). Aucune copie dans le navigateur.
 */
import { useCallback, useState } from 'react';
import type { FilmPageContent, Project, ProjectFilmProfile, SynopsisTexts } from '@/api/types';
import { useAutosave } from '@/features/planner/hooks/useAutosave';
import { useSaveKitFilm } from '../hooks/useKit';

type SyncedField = 'film_profile' | 'synopsis' | 'film_page';
type FieldValue<K extends SyncedField> = NonNullable<Project[K]>;

/** Anciennes copies locales (avant Supabase) : effacées avec le compte. */
export function clearProjectCache(projectId: string): void {
  for (const f of ['film_profile', 'synopsis', 'film_page'] as const) {
    try {
      localStorage.removeItem(`pp-cache-${f}-${projectId}`);
    } catch {
      /* rien */
    }
  }
}

/** Valeur actuelle d'un champ (projet → défaut), en lecture seule. */
export function projectField<K extends SyncedField>(
  project: Project,
  field: K,
  fallback: FieldValue<K>,
): FieldValue<K> {
  return (project[field] as FieldValue<K> | undefined) ?? fallback;
}

/** Champ modifiable, enregistré automatiquement. */
export function useProjectField<K extends SyncedField>(project: Project, field: K, fallback: FieldValue<K>) {
  const [value, setValue] = useState<FieldValue<K>>(() => projectField(project, field, fallback));
  const save = useSaveKitFilm(project.id);
  const autosave = useAutosave(value, (v) => save.mutateAsync({ [field]: v }));
  const set = useCallback(
    (next: FieldValue<K> | ((v: FieldValue<K>) => FieldValue<K>)) =>
      setValue((prev) =>
        typeof next === 'function' ? (next as (v: FieldValue<K>) => FieldValue<K>)(prev) : next,
      ),
    [],
  );
  return [value, set, autosave.state] as const;
}

export const EMPTY_SYNOPSIS: SynopsisTexts = { phrase: '', court: '', long: '' };
/** Page film d'un nouveau projet : aucune photo choisie. */
export const EMPTY_FILM_PAGE: FilmPageContent = { stills: [] };
export function defaultProfile(format: 'court' | 'long'): ProjectFilmProfile {
  return { duration_min: format === 'court' ? 15 : 90, language: 'Derja (arabe tunisien)', genre: 'Fiction' };
}
