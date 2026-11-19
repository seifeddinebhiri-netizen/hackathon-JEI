import type { Passport, Project } from '@/api/types';
import type { DossierContext } from '../lib/dossier';
import { defaultProfile, EMPTY_FILM_PAGE, EMPTY_SYNOPSIS, projectField } from '../lib/localStore';
import { useSubtitleDraft } from './useFestivals';
import { useKit } from './useKit';

/** Contexte de calcul des pièces : synopsis, page film, sous-titres, Passeport et pièces cochées. */
export function useDossierContext(project: Project, passport: Passport | null | undefined): DossierContext {
  const subtitles = useSubtitleDraft(project.id);
  const kit = useKit(project.id);
  const profile = projectField(project, 'film_profile', defaultProfile(project.format));
  return {
    filmDurationMin: profile.duration_min,
    synopsis: projectField(project, 'synopsis', EMPTY_SYNOPSIS),
    filmPage: projectField(project, 'film_page', EMPTY_FILM_PAGE),
    subtitles: subtitles.data?.lines,
    passport,
    pieces: kit.data?.pieces ?? {},
  };
}
