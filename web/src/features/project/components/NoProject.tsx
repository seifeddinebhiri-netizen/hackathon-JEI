import type { ReactNode } from 'react';
import { ButtonLink, EmptyState } from '@/components/ui';

/** Lien vers l'assistant de création (sans `nouveau=1`, il attendrait un projet courant). */
export const NEW_PROJECT_PATH = '/planner/projet?nouveau=1';

/**
 * Compte sans projet courant : la requête du projet est désactivée et resterait « en attente »
 * pour toujours. Les écrans testent `useCurrentProjectId()` avant tout chargement et affichent ceci.
 */
export function NoProject({ children }: { children?: ReactNode }) {
  return (
    <EmptyState
      icon="film"
      title="Bienvenue ! Tu n’as pas encore de projet."
      action={
        <ButtonLink to={NEW_PROJECT_PATH} icon="plus">
          Créer mon premier projet
        </ButtonLink>
      }
    >
      {children ?? 'Crée ton film pour planifier le tournage, déclarer l’IA et préparer tes festivals.'}
    </EmptyState>
  );
}
