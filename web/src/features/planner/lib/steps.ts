/**
 * Étapes de l'assistant « Planifier mon tournage » et leur état (terminée ou non).
 * Partagé entre l'assistant et l'écran de résultat (calendrier), pour garder la même barre.
 */
import type { Project } from '@/api/types';

export const PLANNER_STEPS = [
  { id: 'projet', label: 'Projet' },
  { id: 'scenario', label: 'Scénario' },
  { id: 'lieux', label: 'Lieux' },
  { id: 'personnes', label: 'Personnes' },
  { id: 'generer', label: 'Générer' },
] as const;

/** Adresse de l'assistant pour l'étape n (0 = Projet). */
export const plannerStepPath = (n: number) => `/planner/projet?etape=${n + 1}`;

/**
 * Lieux : terminé dès que chaque scène a un lieu existant. Une adresse manquante n'empêche pas
 * de générer le planning (elle apparaît dans les rappels) : elle ne décoche donc pas l'étape.
 */
export function plannerStepsDone(p: Project | undefined): boolean[] {
  if (!p) return PLANNER_STEPS.map(() => false);
  const locationIds = new Set(p.locations.map((l) => l.id));
  return [
    true,
    p.scenes.length > 0,
    p.locations.length > 0 && p.scenes.every((s) => locationIds.has(s.location_id)),
    p.people.some((x) => x.kind === 'equipe'),
    !!p.schedule,
  ];
}
