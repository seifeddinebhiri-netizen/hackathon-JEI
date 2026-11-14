import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
  type Announcements,
  type CollisionDetection,
  type DragEndEvent,
} from '@dnd-kit/core';
import { addMonths, addWeeks, eachDayOfInterval, parseISO, startOfMonth, startOfWeek } from 'date-fns';
import { useMemo, useState } from 'react';
import {
  AiDraftBadge,
  Button,
  ButtonLink,
  EmptyState,
  ErrorState,
  Icon,
  LoadingBlock,
  PageHeader,
  SegmentedControl,
  StatusChip,
} from '@/components/ui';
import {
  CalendarContext,
  UNPLACED_ID,
  type CalendarCtx,
} from '@/features/planner/components/calendar/context';
import { MoveDialog } from '@/features/planner/components/calendar/MoveDialog';
import { SceneBlock } from '@/features/planner/components/calendar/SceneBlock';
import { ConflictsPanel, UnplacedTray } from '@/features/planner/components/calendar/SidePanel';
import { DayListView, MonthView, WeekView } from '@/features/planner/components/calendar/Views';
import { monthLabel, weekLabel } from '@/features/planner/lib/periods';
import { GenerateScheduleButton } from '@/features/planner/components/GenerateScheduleButton';
import { usePeriodWeather } from '@/features/planner/hooks/usePlanner';
import { useScheduleEditor } from '@/features/planner/hooks/useScheduleEditor';
import { jumpToDroppable } from '@/features/planner/lib/keyboard';
import { countConflicts } from '@/features/planner/lib/rules';
import { findScene, scenesNotInSchedule } from '@/features/planner/lib/schedule';
import { useCurrentProject } from '@/features/project/hooks/useProject';
import { formatDayLong, isoDay } from '@/lib/format';
import { useMediaQuery } from '@/lib/useMediaQuery';
import type { Project, Schedule } from '@/api/types';

const collision: CollisionDetection = (args) => {
  const p = pointerWithin(args);
  return p.length ? p : rectIntersection(args);
};

function targetOf(overId: string | number | undefined): string | null | undefined {
  if (overId === undefined) return undefined;
  const id = String(overId);
  if (id === UNPLACED_ID) return null;
  if (id.startsWith('jour:')) return id.slice(5);
  return undefined;
}

function Calendar({ project, schedule }: { project: Project; schedule: Schedule }) {
  const weather = usePeriodWeather(project);
  const editor = useScheduleEditor(project, weather.byDate);
  const [view, setView] = useState<'semaine' | 'mois'>('semaine');
  const first = parseISO(project.shooting_window.from);
  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(schedule.days[0] ? parseISO(schedule.days[0].date) : first, { weekStartsOn: 1 }),
  );
  const [month, setMonth] = useState(() => startOfMonth(first));
  const [activeId, setActiveId] = useState<string | null>(null);
  const [moveId, setMoveId] = useState<string | null>(null);
  // Une seule vue montée à la fois : chaque scène doit avoir un seul élément déplaçable
  const desktop = useMediaQuery('(min-width: 768px)');

  const { from: winFrom, to: winTo } = project.shooting_window;
  const windowDates = useMemo(
    () => eachDayOfInterval({ start: parseISO(winFrom), end: parseISO(winTo) }).map(isoDay),
    [winFrom, winTo],
  );
  const daysByDate = useMemo(() => new Map(schedule.days.map((d) => [d.date, d])), [schedule.days]);
  const extra = scenesNotInSchedule(schedule, project);

  const ctx: CalendarCtx = useMemo(
    () => ({
      project,
      sceneById: new Map(project.scenes.map((s) => [s.id, s])),
      locationById: new Map(project.locations.map((l) => [l.id, l])),
      scheduledById: new Map(schedule.days.flatMap((d) => d.scenes.map((s) => [s.scene_id, s] as const))),
      weatherByDate: new Map([
        ...schedule.days.filter((d) => d.weather).map((d) => [d.date, d.weather!] as const),
        ...weather.byDate,
      ]),
      windowDates,
      onMoveRequest: setMoveId,
    }),
    [project, schedule, weather.byDate, windowDates],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: jumpToDroppable }),
  );

  const label = (id: string | number) => {
    const s = ctx.sceneById.get(String(id));
    return s ? `scène ${s.number} (${s.title})` : 'scène';
  };
  const where = (over: string | number | undefined) => {
    const t = targetOf(over);
    return t === null ? 'les scènes non placées' : t ? formatDayLong(t) : 'aucune case';
  };
  const announcements: Announcements = {
    onDragStart: ({ active }) =>
      `Tu as pris la ${label(active.id)}. Flèches pour changer de jour, Espace pour déposer, Échap pour annuler.`,
    onDragOver: ({ active, over }) => `${label(active.id)} au-dessus de ${where(over?.id)}.`,
    onDragEnd: ({ active, over }) =>
      over
        ? `${label(active.id)} déposée sur ${where(over.id)}.`
        : `${label(active.id)} relâchée hors du calendrier.`,
    onDragCancel: ({ active }) => `Déplacement de la ${label(active.id)} annulé.`,
  };

  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const to = targetOf(e.over?.id);
    if (to === undefined) return;
    editor.move(String(e.active.id), to);
  };

  const placed = schedule.days.reduce((n, d) => n + d.scenes.length, 0);
  const conflicts = countConflicts(schedule.days).total;
  const minWeek = startOfWeek(first, { weekStartsOn: 1 });
  const maxWeek = startOfWeek(parseISO(project.shooting_window.to), { weekStartsOn: 1 });
  const minMonth = startOfMonth(first);
  const maxMonth = startOfMonth(parseISO(project.shooting_window.to));

  return (
    <CalendarContext.Provider value={ctx}>
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-2 border-ink bg-white p-3 md:p-4">
          <div className="flex flex-wrap items-center gap-2">
            <AiDraftBadge validated={schedule.status === 'valide'} />
            <StatusChip tone={placed === project.scenes.length ? 'ok' : 'warn'} icon="film">
              {placed}/{project.scenes.length} scènes placées
            </StatusChip>
            <StatusChip tone={conflicts ? 'warn' : 'ok'}>
              {conflicts} conflit{conflicts > 1 ? 's' : ''}
            </StatusChip>
            {weather.isPending ? (
              <span className="text-meta text-muted-on-light">Chargement de la météo…</span>
            ) : null}
            {weather.isError ? (
              <span className="flex items-center gap-1 text-meta text-bad-fg">
                <Icon name="alert" size={14} /> Météo indisponible : conflits calculés avec la dernière météo
                connue.
              </span>
            ) : null}
            {editor.saving ? (
              <span role="status" className="text-meta text-muted-on-light">
                Enregistrement…
              </span>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-3">
            <GenerateScheduleButton project={project} variant="secondary" size="sm" />
            {schedule.status === 'brouillon_ia' ? (
              <Button icon="check" size="sm" onClick={editor.validate} loading={editor.saving}>
                Valider le planning
              </Button>
            ) : (
              <StatusChip tone="ok">Planning validé</StatusChip>
            )}
          </div>
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={collision}
          onDragStart={(e) => setActiveId(String(e.active.id))}
          onDragCancel={() => setActiveId(null)}
          onDragEnd={onDragEnd}
          accessibility={{
            announcements,
            screenReaderInstructions: {
              draggable:
                'Pour déplacer une scène : Espace pour la prendre, flèches pour changer de jour, Espace pour la déposer, Échap pour annuler. Ou utilise le bouton « Déplacer vers… ».',
            },
          }}
        >
          <div className="grid grid-cols-1 gap-6 2xl:grid-cols-12">
            <div className="min-w-0 2xl:col-span-9">
              {/* Desktop : semaine / mois */}
              {desktop ? (
                <div>
                  <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                    <SegmentedControl
                      legend="Affichage"
                      value={view}
                      onChange={setView}
                      options={[
                        { value: 'semaine', label: 'Semaine' },
                        { value: 'mois', label: 'Mois' },
                      ]}
                    />
                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        icon="chevronLeft"
                        disabled={view === 'semaine' ? weekStart <= minWeek : month <= minMonth}
                        onClick={() =>
                          view === 'semaine'
                            ? setWeekStart((w) => addWeeks(w, -1))
                            : setMonth((m) => addMonths(m, -1))
                        }
                      >
                        <span className="sr-only">Période précédente</span>
                      </Button>
                      <p
                        className="min-w-52 text-center font-display text-[20px] font-bold first-letter:uppercase"
                        aria-live="polite"
                      >
                        {view === 'semaine' ? weekLabel(weekStart) : monthLabel(month)}
                      </p>
                      <Button
                        variant="secondary"
                        size="sm"
                        icon="chevronRight"
                        disabled={view === 'semaine' ? weekStart >= maxWeek : month >= maxMonth}
                        onClick={() =>
                          view === 'semaine'
                            ? setWeekStart((w) => addWeeks(w, 1))
                            : setMonth((m) => addMonths(m, 1))
                        }
                      >
                        <span className="sr-only">Période suivante</span>
                      </Button>
                    </div>
                  </div>
                  {view === 'semaine' ? (
                    <WeekView weekStart={weekStart} days={daysByDate} />
                  ) : (
                    <MonthView month={month} days={daysByDate} />
                  )}
                  <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-meta text-muted-on-light">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="inline-block h-4 w-6 border-l-[6px] border-ink bg-ext" /> EXT ·
                      extérieur
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="inline-block h-4 w-6 border-l-[6px] border-muted-on-light bg-int" />{' '}
                      INT · intérieur
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Icon name="alert" size={14} className="text-bad-fg" /> conflit
                    </span>
                    <span>Glisse une scène, ou utilise le bouton calendrier d’un bloc.</span>
                  </p>
                </div>
              ) : (
                /* Mobile : liste par jour */
                <DayListView days={schedule.days} />
              )}
            </div>

            <aside
              className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:col-span-3 2xl:flex 2xl:flex-col"
              aria-label="Conflits et scènes non placées"
            >
              <UnplacedTray schedule={schedule} extra={extra} />
              <ConflictsPanel schedule={schedule} />
            </aside>
          </div>
          <DragOverlay>{activeId ? <SceneBlock sceneId={activeId} overlay /> : null}</DragOverlay>
        </DndContext>
      </div>
      <MoveDialog
        sceneId={moveId}
        currentDate={moveId ? findScene(schedule, moveId) : undefined}
        onClose={() => setMoveId(null)}
        onMove={(id, to) => editor.move(id, to)}
      />
    </CalendarContext.Provider>
  );
}

export default function PlannerCalendar() {
  const project = useCurrentProject();
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Planifier · Calendrier"
        title="Calendrier de tournage"
        lead="Déplace les scènes à la main : les horaires et les conflits sont recalculés à chaque fois."
        actions={
          <ButtonLink to="/planner/projet?etape=2" variant="secondary" icon="edit">
            Modifier les scènes
          </ButtonLink>
        }
      />
      {project.isPending ? (
        <LoadingBlock lines={8} label="Chargement du planning…" />
      ) : project.isError ? (
        <ErrorState error={project.error} onRetry={() => void project.refetch()} />
      ) : !project.data.schedule ? (
        <EmptyState
          icon="calendar"
          title="Pas encore de planning"
          action={
            project.data.scenes.length ? (
              <GenerateScheduleButton project={project.data} />
            ) : (
              <ButtonLink to="/planner/projet?etape=2" iconRight="arrowRight">
                Ajouter mes scènes
              </ButtonLink>
            )
          }
        >
          {project.data.scenes.length
            ? 'Tes scènes sont prêtes : génère un premier brouillon de planning, puis ajuste-le à la main.'
            : 'Ajoute d’abord tes scènes et tes lieux dans l’assistant.'}
        </EmptyState>
      ) : (
        <Calendar project={project.data} schedule={project.data.schedule} />
      )}
    </div>
  );
}
