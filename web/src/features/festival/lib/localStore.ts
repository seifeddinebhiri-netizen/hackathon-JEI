/**
 * Données du Kit Festival que le contrat d'API ne prévoit pas encore (profil du film, synopsis,
 * contenu éditable de la page film). Gardées dans le navigateur, par projet, en attendant un
 * endpoint (voir docs/API_CONTRACT.md, « à confirmer »).
 */
import { useCallback, useState } from 'react';
import type { FilmProfile } from '@/api/types';

export type SynopsisDraft = { phrase: string; court: string; long: string };
export type FilmPageDraft = { trailer_url: string; stills: string[] };

const key = (kind: string, projectId: string) => `pp-${kind}-${projectId}`;

export function readLocal<T>(kind: string, projectId: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key(kind, projectId));
    return raw ? { ...fallback, ...(JSON.parse(raw) as T) } : fallback;
  } catch {
    return fallback;
  }
}

function writeLocal<T>(kind: string, projectId: string, value: T): void {
  try {
    localStorage.setItem(key(kind, projectId), JSON.stringify(value));
  } catch {
    /* stockage indisponible : la valeur reste en mémoire */
  }
}

export function useLocalDraft<T>(kind: string, projectId: string, fallback: T) {
  const [value, setValue] = useState<T>(() => readLocal(kind, projectId, fallback));
  const set = useCallback(
    (next: T | ((v: T) => T)) =>
      setValue((prev) => {
        const v = typeof next === 'function' ? (next as (v: T) => T)(prev) : next;
        writeLocal(kind, projectId, v);
        return v;
      }),
    [kind, projectId],
  );
  return [value, set] as const;
}

export const EMPTY_SYNOPSIS: SynopsisDraft = { phrase: '', court: '', long: '' };
export const EMPTY_FILM_PAGE: FilmPageDraft = {
  trailer_url: '',
  stills: ['/photos/ruelle.jpg', '/photos/porte.jpg', '/photos/cote.jpg'],
};
export function defaultProfile(format: 'court' | 'long', aiDepartments: number): FilmProfile {
  return {
    duration_min: format === 'court' ? 15 : 90,
    language: 'Derja (arabe tunisien)',
    genre: 'Fiction',
    declared_ai_departments: aiDepartments,
  };
}
