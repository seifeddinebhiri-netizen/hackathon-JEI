import type { Passport, Project } from '@/api/types';
import type { IconName } from '@/components/ui';
import { DEPARTMENTS } from '@/features/passport/lib/labels';
import { countConflicts } from '@/features/planner/lib/rules';

export type Todo = {
  id: string;
  icon: IconName;
  label: string;
  to: string;
  tone: 'warn' | 'bad' | 'neutral';
};

/** Liste « À faire » du tableau de bord, déduite de l'état du projet. */
export function projectTodos(project: Project, passport: Passport | null | undefined): Todo[] {
  const t: Todo[] = [];
  const toReview = project.scenes.filter((s) => !s.validated).length;
  if (project.scenes.length === 0)
    t.push({
      id: 'scenes',
      icon: 'film',
      label: 'Ajouter les scènes du film',
      to: '/planner/projet?etape=2',
      tone: 'bad',
    });
  else if (toReview)
    t.push({
      id: 'relire',
      icon: 'sparkle',
      label: `Relire ${toReview} scène(s) proposée(s) par l’IA`,
      to: '/planner/projet?etape=2',
      tone: 'warn',
    });

  for (const l of project.locations.filter((x) => x.permit === 'a_demander'))
    t.push({
      id: `permis-${l.id}`,
      icon: 'doc',
      label: `Demander l’autorisation de tournage : ${l.name}`,
      to: '/planner/projet?etape=3',
      tone: 'warn',
    });

  const noActor = project.people.filter((p) => p.kind === 'acteur' && !p.name.trim()).length;
  if (noActor)
    t.push({
      id: 'acteurs',
      icon: 'users',
      label: `Distribuer ${noActor} rôle(s)`,
      to: '/planner/projet?etape=4',
      tone: 'neutral',
    });

  if (!project.schedule) {
    if (project.scenes.length)
      t.push({
        id: 'planning',
        icon: 'calendar',
        label: 'Générer le planning',
        to: '/planner/projet?etape=5',
        tone: 'warn',
      });
  } else {
    const c = countConflicts(project.schedule.days).total;
    const unplaced = project.schedule.unplaced.length;
    if (unplaced)
      t.push({
        id: 'non-placees',
        icon: 'layers',
        label: `Placer ${unplaced} scène(s) restante(s)`,
        to: '/planner/calendrier',
        tone: 'warn',
      });
    if (c)
      t.push({
        id: 'conflits',
        icon: 'alert',
        label: `Régler ${c} conflit(s) du planning`,
        to: '/planner/calendrier',
        tone: 'warn',
      });
    if (project.schedule.status === 'brouillon_ia')
      t.push({
        id: 'valider',
        icon: 'check',
        label: 'Valider le planning',
        to: '/planner/calendrier',
        tone: 'neutral',
      });
  }

  const declared = passport?.declarations.length ?? 0;
  if (declared < DEPARTMENTS.length)
    t.push({
      id: 'passeport',
      icon: 'shield',
      label: `Compléter le Passeport IA (${declared}/${DEPARTMENTS.length})`,
      to: '/passeport',
      tone: 'neutral',
    });

  const toPrepare = project.festival_shortlist.filter((f) => f.status === 'a_preparer').length;
  if (toPrepare)
    t.push({
      id: 'dossiers',
      icon: 'film',
      label: `Préparer ${toPrepare} dossier(s) de festival`,
      to: '/festival/dossiers',
      tone: 'neutral',
    });
  return t;
}
