import { useCallback } from 'react';
import type { Project, Schedule } from '@/api';
import { useToast } from '@/components/ui';
import { moveScene, reorderDay, setCallTime, type WeatherByDate } from '../lib/schedule';
import { useOptimisticProjectUpdate } from './usePlanner';

/**
 * Éditeur de planning : déplacer, retirer, réordonner, valider. Enregistre à chaque action.
 * Après validation, on peut encore modifier : le statut reste « validé ».
 */
export function useScheduleEditor(project: Project | undefined, weather: WeatherByDate) {
  const update = useOptimisticProjectUpdate(project?.id);
  const { toast } = useToast();

  const save = useCallback(
    (schedule: Schedule) => {
      update.mutate(
        { schedule },
        {
          onError: (e) =>
            toast({ tone: 'bad', title: 'Modification non enregistrée', description: e.message }),
        },
      );
    },
    [update, toast],
  );

  const ctx = project ? { project, weather } : undefined;

  return {
    saving: update.isPending,
    move: (sceneId: string, toDate: string | null) => {
      if (!project?.schedule || !ctx) return;
      save(moveScene(project.schedule, sceneId, toDate, ctx));
    },
    reorder: (date: string, orderedIds: string[]) => {
      if (!project?.schedule || !ctx) return;
      save(reorderDay(project.schedule, date, orderedIds, ctx));
    },
    setCallTime: (date: string, hhmm: string) => {
      if (!project?.schedule) return;
      save(setCallTime(project.schedule, date, hhmm));
    },
    validate: () => {
      if (!project?.schedule) return;
      update.mutate(
        { schedule: { ...project.schedule, status: 'valide' } },
        {
          onSuccess: () =>
            toast({ tone: 'ok', title: 'Planning validé', description: 'Tu peux encore le modifier.' }),
          onError: (e) => toast({ tone: 'bad', title: 'Validation impossible', description: e.message }),
        },
      );
    },
    restore: (schedule: Schedule | undefined) => {
      update.mutate({ schedule });
    },
  };
}
