import type { Location, Person, Scene } from '@/api/types';

/** Brouillon partagé entre les étapes Scénario, Lieux et Personnes (enregistré automatiquement). */
export type PlannerDraft = { scenes: Scene[]; locations: Location[]; people: Person[] };

/** Éléments détectés par l'IA lors de l'import (pour afficher « Brouillon IA »). Gardé en sessionStorage. */
export type Detected = { locations: string[]; people: string[] };

export type DraftSetter = (fn: (d: PlannerDraft) => PlannerDraft) => void;
