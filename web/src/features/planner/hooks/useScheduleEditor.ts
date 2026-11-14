import { eachDayOfInterval, parseISO } from 'date-fns';
import { useCallback, useMemo } from 'react';
import type { Project, Schedule, ScheduleConflict } from '@/api';
import { useToast } from '@/components/ui';
import { isoDay } from '@/lib/format';
import {
  moveScene,
  moveSceneToTime,
  reevaluateAll,
  reorderDay,
  setCallTime,
  suggestMove,
  type WeatherByDate,
} from '../lib/schedule';
import { useOptimisticProjectUpdate } from './usePlanner';

/**
 * Éditeur de planning : déplacer (jour ou heure précise), retirer, réordonner, valider,
 * actions sur les conflits. Enregistre à chaque action. Après validation, on peut encore modifier.
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

  const from = project?.shooting_window.from;
  const to = project?.shooting_window.to;
  const windowDates = useMemo(
    () => (from && to ? eachDayOfInterval({ start: parseISO(from), end: parseISO(to) }).map(isoDay) : []),
    [from, to],
  );
  const ctx = project ? { project, weather, windowDates } : undefined;
  const sceneLabel = (id: string) => {
    const s = project?.scenes.find((x) => x.id === id);
    return s ? `scène ${s.number}` : 'une autre scène';
  };

  return {
    saving: update.isPending,
    windowDates,
    move: (sceneId: string, toDate: string | null) => {
      if (!project?.schedule || !ctx) return;
      save(moveScene(project.schedule, sceneId, toDate, ctx));
    },
    /** Pose une scène à « HH:mm » ; renvoie false si elle chevauche une autre scène. */
    moveToTime: (sceneId: string, toDate: string, hhmm: string): boolean => {
      if (!project?.schedule || !ctx) return false;
      const r = moveSceneToTime(project.schedule, sceneId, toDate, hhmm, ctx);
      if ('error' in r) {
        toast({
          tone: 'bad',
          title: `Horaire impossible : chevauche la ${sceneLabel(r.withSceneId)}`,
          description:
            'Choisis un autre horaire, ou dépose la scène sur la date pour qu’elle prenne le premier créneau libre.',
        });
        return false;
      }
      save(r.schedule);
      return true;
    },
    reorder: (date: string, orderedIds: string[]) => {
      if (!project?.schedule || !ctx) return;
      save(reorderDay(project.schedule, date, orderedIds, ctx));
    },
    setCallTime: (date: string, hhmm: string) => {
      if (!project?.schedule) return;
      save(setCallTime(project.schedule, date, hhmm));
    },
    /** Jour proposé pour résoudre un conflit (calculé par les règles), ou undefined. */
    suggest: (sceneIds: string[], kind: ScheduleConflict['kind']) =>
      project?.schedule && ctx ? suggestMove(project.schedule, sceneIds, kind, ctx) : undefined,
    moveMany: (sceneIds: string[], toDate: string) => {
      if (!project?.schedule || !ctx) return;
      save(sceneIds.reduce((s, id) => moveScene(s, id, toDate, ctx), project.schedule));
    },
    /** « Marquer comme obtenue » : met à jour le lieu et recalcule les conflits, en un seul enregistrement. */
    markPermitObtained: (locationId: string) => {
      if (!project?.schedule) return;
      const locations = project.locations.map((l) =>
        l.id === locationId ? { ...l, permit: 'obtenue' as const } : l,
      );
      const schedule = reevaluateAll(project.schedule, { project: { ...project, locations }, weather });
      update.mutate(
        { locations, schedule },
        {
          onSuccess: () => toast({ tone: 'ok', title: 'Autorisation marquée comme obtenue' }),
          onError: (e) =>
            toast({ tone: 'bad', title: 'Modification non enregistrée', description: e.message }),
        },
      );
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
