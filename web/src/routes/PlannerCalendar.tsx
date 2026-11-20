import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
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
import { useIsMutating } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import type { Project, Schedule, ShootingDay } from '@/api/types';
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
  Stepper,
  useToast,
} from '@/components/ui';
import { PLANNER_STEPS, plannerStepPath, plannerStepsDone } from '@/features/planner/lib/steps';
import { ConflictPanel } from '@/features/planner/components/calendar/ConflictPanel';
import {
  CalendarContext,
  parseDropTarget,
  useCalendar,
  type CalendarCtx,
} from '@/features/planner/components/calendar/context';
import { DayRow } from '@/features/planner/components/calendar/DayRow';
import { FreeDaysRow } from '@/features/planner/components/calendar/FreeDaysRow';
import {
  DAY_LIGHT_CLASS,
  FULL_RANGE,
  LIGHT_CLASSES,
  snapToHHMM,
} from '@/features/planner/components/calendar/geometry';
import { dayShortLabel, sceneHeadingPlain } from '@/features/planner/components/calendar/sceneText';
import { MobileDayCard } from '@/features/planner/components/calendar/MobileDayCard';
import { MoveDialog } from '@/features/planner/components/calendar/MoveDialog';
import { PeriodView } from '@/features/planner/components/calendar/PeriodView';
import { SceneChip } from '@/features/planner/components/calendar/SceneChip';
import { UnplacedTray } from '@/features/planner/components/calendar/UnplacedTray';
import { GenerateScheduleButton } from '@/features/planner/components/GenerateScheduleButton';
import { usePeriodWeather } from '@/features/planner/hooks/usePlanner';
import { useScheduleEditor } from '@/features/planner/hooks/useScheduleEditor';
import { jumpToDroppable } from '@/features/planner/lib/keyboard';
import { SETTING_SWATCH } from '@/features/planner/lib/labels';
import { anchoredSlot, countConflicts } from '@/features/planner/lib/rules';
import { findScene, groupConflicts, scenesNotInSchedule } from '@/features/planner/lib/schedule';
import { useCurrentProject } from '@/features/project/hooks/useProject';
import { cn } from '@/lib/cn';
import { formatDayLong, formatHourFr } from '@/lib/format';
import { useMediaQuery } from '@/lib/useMediaQuery';

const collision: CollisionDetection = (args) => {
  const p = pointerWithin(args);
  return p.length ? p : rectIntersection(args);
};

type Item = { type: 'day'; day: ShootingDay; index: number } | { type: 'free'; dates: string[] };

/** Jours de tournage + jours libres consécutifs regroupés. */
function buildItems(windowDates: string[], days: ShootingDay[]): Item[] {
  const byDate = new Map(days.map((d) => [d.date, d]));
  const all = [...new Set([...windowDates, ...days.map((d) => d.date)])].sort();
  const items: Item[] = [];
  let free: string[] = [];
  let index = 0;
  for (const date of all) {
    const day = byDate.get(date);
    if (day) {
      if (free.length) items.push({ type: 'free', dates: free });
      free = [];
      items.push({ type: 'day', day, index: index++ });
    } else free.push(date);
  }
  if (free.length) items.push({ type: 'free', dates: free });
  return items;
}

/** Légende de la frise : trois entrées seulement. */
function Legend() {
  return (
    <ul
      className="flex flex-wrap items-center gap-x-5 gap-y-1 text-meta text-muted-on-light"
      aria-label="Comment lire la frise"
    >
      <li className="inline-flex items-center gap-2">
        <span aria-hidden className={cn('inline-block h-4 w-6 rounded-sm', SETTING_SWATCH.INT)} /> Scène en
        intérieur
      </li>
      <li className="inline-flex items-center gap-2">
        <span aria-hidden className={cn('inline-block h-4 w-6 rounded-sm', SETTING_SWATCH.EXT)} /> Scène en
        extérieur
      </li>
      <li className="inline-flex items-center gap-2">
        <span aria-hidden className="inline-flex h-1.5 w-9 overflow-hidden rounded-full">
          <span className={cn('flex-1', LIGHT_CLASSES.nuit)} />
          <span className={cn('flex-1', DAY_LIGHT_CLASS)} />
          <span className={cn('flex-1', LIGHT_CLASSES.heure_doree)} />
        </span>
        Nuit / jour / lumière du soir
      </li>
    </ul>
  );
}

/** Tri dans l'ordre du script : 1, 2, 2A, 10… */
const byNumber = (a: { number: string }, b: { number: string }) =>
  a.number.localeCompare(b.number, 'fr', { numeric: true });

/**
 * « Votre scénario, scène par scène » : les scènes dans l'ordre du script, avec le jour et l'heure
 * où chacune est tournée. Un clic amène au jour et met la scène en surbrillance.
 */
function ScriptColumn({
  schedule,
  onPick,
}: {
  schedule: Schedule;
  onPick: (sceneId: string, date: string | null) => void;
}) {
  const { project, scheduledById } = useCalendar();
  const dayIndex = new Map(schedule.days.map((d, i) => [d.date, i]));
  return (
    <aside
      aria-labelledby="scenario-titre"
      className="min-h-0 overflow-y-auto border-2 border-line-light bg-white p-4"
    >
      <h2 id="scenario-titre" className="text-h3">
        Votre scénario, scène par scène
      </h2>
      <p className="mt-1 text-meta text-muted-on-light">
        Dans l’ordre du script : quand chaque scène est tournée.
      </p>
      <ol className="-mx-2 mt-3 flex flex-col">
        {[...project.scenes].sort(byNumber).map((scene) => {
          const sch = scheduledById.get(scene.id);
          const date = sch?.start.slice(0, 10) ?? null;
          const n = sch?.conflicts.length ?? 0;
          return (
            <li key={scene.id}>
              <button
                type="button"
                onClick={() => onPick(scene.id, date)}
                className="flex min-h-11 w-full flex-col px-2 py-2 text-left hover:bg-gold-soft/50"
              >
                <span className="flex w-full items-start gap-2 font-display text-meta font-bold">
                  <span className="min-w-0 flex-1">{sceneHeadingPlain(scene)}</span>
                  {n ? (
                    <span className="mt-1 inline-flex shrink-0">
                      <span aria-hidden className="size-2.5 rounded-full bg-conflict" />
                      <span className="sr-only">
                        , {n} point{n > 1 ? 's' : ''} à régler
                      </span>
                    </span>
                  ) : null}
                </span>
                <span className="text-meta text-muted-on-light">
                  {sch && date
                    ? `${dayShortLabel(date, dayIndex.get(date) ?? 0)} · ${formatHourFr(sch.start)}`
                    : 'Pas encore placée'}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}

/** Actions du planning, empilées : la convocation d'abord (bouton principal). */
function PlanningActions({ className }: { className?: string }) {
  return (
    <div className={className ?? 'flex flex-col gap-3'}>
      <ButtonLink to="/planner/convocations" icon="mail" className="w-full">
        Préparer les convocations
      </ButtonLink>
      <ButtonLink to="/planner/projet?etape=2" variant="secondary" icon="edit" className="w-full">
        Modifier les scènes
      </ButtonLink>
      <ButtonLink to="/planner/planning?pdf=1" variant="secondary" icon="download" className="w-full">
        Télécharger en PDF
      </ButtonLink>
    </div>
  );
}

function Calendar({ project, schedule }: { project: Project; schedule: Schedule }) {
  const weather = usePeriodWeather(project);
  const editor = useScheduleEditor(project, weather.byDate);
  const { toast } = useToast();
  const desktop = useMediaQuery('(min-width: 768px)');
  const [view, setView] = useState<'jours' | 'periode'>('jours');
  const [highlight, setHighlight] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [moveId, setMoveId] = useState<string | null>(null);
  const [highlightScene, setHighlightScene] = useState<string | null>(null);
  const { windowDates } = editor;

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
      dragging: activeId !== null,
      onMoveRequest: setMoveId,
      onShift: (sceneId, date, hhmm) => {
        if (editor.moveToTime(sceneId, date, hhmm)) setHighlight(date);
      },
      highlightScene,
    }),
    // `editor` change d'identité à chaque rendu ; ses actions lisent toujours le projet courant.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [project, schedule, weather.byDate, windowDates, activeId, highlightScene],
  );

  const items = useMemo(() => buildItems(windowDates, schedule.days), [windowDates, schedule.days]);
  const daysByDate = useMemo(() => new Map(schedule.days.map((d) => [d.date, d])), [schedule.days]);
  const groups = groupConflicts(schedule, project);
  const extra = scenesNotInSchedule(schedule, project);

  // Ouvrir un jour depuis la vue « Période » ou après un déplacement
  useEffect(() => {
    if (view !== 'jours' || !highlight) return;
    const free = items.find((it) => it.type === 'free' && it.dates.includes(highlight));
    const id = free && free.type === 'free' ? `libre-${free.dates[0]}` : `jour-${highlight}`;
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [view, highlight, items]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: jumpToDroppable,
      // Entrée ouvre le détail d'une scène ; Espace sert à la déplacer
      keyboardCodes: { start: ['Space'], cancel: ['Escape'], end: ['Space', 'Enter'] },
    }),
  );

  const label = (id: string | number) => {
    const s = ctx.sceneById.get(String(id));
    return s ? `scène ${s.number} (${s.title})` : 'scène';
  };
  const where = (over: string | number | undefined) => {
    const t = parseDropTarget(over);
    if (!t) return 'aucune zone';
    if (t.kind === 'unplaced') return 'les scènes non placées';
    return `${formatDayLong(t.date)}${t.kind === 'timeline' ? ', sur la frise horaire' : ''}`;
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
    const target = parseDropTarget(e.over?.id);
    if (!target) return;
    const sceneId = String(e.active.id);
    if (target.kind === 'unplaced') return editor.move(sceneId, null);
    if (target.kind === 'day') return editor.move(sceneId, target.date);
    // Frise horaire : heure précise à la souris ou au toucher (pas de 15 min)
    const scene = ctx.sceneById.get(sceneId);
    const keyboard = e.activatorEvent instanceof KeyboardEvent;
    const anchored = scene
      ? !!anchoredSlot(scene, target.date, ctx.locationById.get(scene.location_id))
      : false;
    const rect = e.active.rect.current.translated;
    if (keyboard || anchored || !rect || !e.over || !scene) {
      if (anchored && findScene(schedule, sceneId) === target.date)
        toast({
          tone: 'info',
          title: 'Horaire calé sur le soleil',
          description: 'Les scènes au lever du soleil, en lumière du soir ou de nuit suivent le soleil.',
        });
      return editor.move(sceneId, target.date);
    }
    // Pendant le glisser-déposer, toutes les frises affichent la plage pleine 6 h–24 h
    const span = FULL_RANGE.to - FULL_RANGE.from;
    const hours = FULL_RANGE.from + ((rect.left - e.over.rect.left) / e.over.rect.width) * span;
    editor.moveToTime(sceneId, target.date, snapToHHMM(hours, scene.estimated_hours, FULL_RANGE));
  };

  const placed = schedule.days.reduce((n, d) => n + d.scenes.length, 0);
  const conflicts = countConflicts(schedule.days).total;

  return (
    <CalendarContext.Provider value={ctx}>
      <div className="flex flex-col gap-6">
        {/* Statuts et actions */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-2 border-ink bg-white p-3 md:p-4">
          <div className="flex flex-wrap items-center gap-2">
            <AiDraftBadge validated={schedule.status === 'valide'} />
            <StatusChip tone={placed === project.scenes.length ? 'ok' : 'warn'} icon="film">
              {placed}/{project.scenes.length} scènes · {schedule.days.length} jours
            </StatusChip>
            <StatusChip tone={conflicts ? 'warn' : 'ok'}>
              {conflicts} conflit{conflicts > 1 ? 's' : ''}
            </StatusChip>
            {weather.isPending ? (
              <span className="text-meta text-muted-on-light">Chargement de la météo…</span>
            ) : null}
            {weather.isError ? (
              <span className="flex items-center gap-1 text-meta text-bad-fg">
                <Icon name="alert" size={14} /> Météo indisponible : dernière météo connue.
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
          measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
          onDragStart={(e) => setActiveId(String(e.active.id))}
          onDragCancel={() => setActiveId(null)}
          onDragEnd={onDragEnd}
          accessibility={{
            announcements,
            screenReaderInstructions: {
              draggable:
                'Pour déplacer une scène : Espace pour la prendre, flèches pour changer de jour, Espace pour la déposer, Échap pour annuler. Entrée ouvre le détail et le menu « Déplacer vers… ».',
            },
          }}
        >
          <ConflictPanel
            groups={groups}
            suggest={(g) => editor.suggest(g.sceneIds, g.kind)}
            onMarkPermit={editor.markPermitObtained}
            onMove={(ids, date) => {
              editor.moveMany(ids, date);
              setHighlight(date);
            }}
            busy={editor.saving}
          />
          <UnplacedTray schedule={schedule} extra={extra} />

          <PlanningActions
            className={
              view === 'periode'
                ? 'flex flex-col gap-3 sm:flex-row'
                : 'flex flex-col gap-3 sm:flex-row lg:hidden'
            }
          />

          <div className="flex scroll-mt-24 flex-wrap items-end justify-between gap-4">
            <SegmentedControl
              legend="Affichage"
              value={view}
              onChange={setView}
              options={[
                { value: 'jours', label: 'Jours de tournage' },
                { value: 'periode', label: 'Période' },
              ]}
            />
            <Legend />
          </div>

          {view === 'periode' ? (
            <PeriodView
              days={daysByDate}
              onOpenDay={(date) => {
                setHighlight(date);
                setView('jours');
              }}
            />
          ) : desktop ? (
            <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="min-w-0">
                <ol className="flex flex-col gap-3" aria-label="Jours de tournage">
                  {items.map((it) =>
                    it.type === 'day' ? (
                      <DayRow
                        key={it.day.date}
                        day={it.day}
                        index={it.index}
                        highlight={highlight === it.day.date}
                      />
                    ) : (
                      <FreeDaysRow
                        key={it.dates[0]}
                        dates={it.dates}
                        highlight={!!highlight && it.dates.includes(highlight)}
                      />
                    ),
                  )}
                </ol>
                <p className="mt-3 text-meta text-muted-on-light">
                  Glisse une scène sur la frise pour la poser à une heure précise (au quart d’heure), ou sur
                  la date pour qu’elle prenne le premier créneau libre. Entrée sur une scène : détail et «
                  Déplacer vers… ».
                </p>
              </div>
              {/* Colonne de droite : la carte et les actions restent collées ensemble */}
              <div className="sticky top-24 hidden max-h-[calc(100dvh-7rem)] flex-col gap-4 lg:flex">
                <ScriptColumn
                  schedule={schedule}
                  onPick={(sceneId, date) => {
                    setHighlightScene(sceneId);
                    const target = date ? `jour-${date}` : 'non-placees-titre';
                    if (date) setHighlight(date);
                    document.getElementById(target)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                />
                <PlanningActions className="flex shrink-0 flex-col gap-3" />
              </div>
            </div>
          ) : (
            <ol className="flex flex-col gap-3" aria-label="Jours de tournage">
              {items.map((it) =>
                it.type === 'day' ? (
                  <MobileDayCard
                    key={it.day.date}
                    day={it.day}
                    index={it.index}
                    highlight={highlight === it.day.date}
                  />
                ) : (
                  <FreeDaysRow
                    key={it.dates[0]}
                    dates={it.dates}
                    highlight={!!highlight && it.dates.includes(highlight)}
                  />
                ),
              )}
            </ol>
          )}
          <DragOverlay>
            {activeId ? (
              <div className="w-[min(420px,80vw)]">
                <SceneChip sceneId={activeId} overlay />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
      <MoveDialog
        sceneId={moveId}
        currentDate={moveId ? findScene(schedule, moveId) : undefined}
        onClose={() => setMoveId(null)}
        onMove={(id, to) => {
          editor.move(id, to);
          if (to) setHighlight(to);
        }}
      />
    </CalendarContext.Provider>
  );
}

/** Barre d'étapes de l'assistant, avec l'étape Générer en cours : on revient à une étape d'un clic. */
function PlannerSteps({ project }: { project: Project | undefined }) {
  const navigate = useNavigate();
  const saving = useIsMutating() > 0;
  const done = plannerStepsDone(project);
  return (
    <div className="flex flex-col gap-2">
      <Stepper
        compact
        steps={PLANNER_STEPS.map((s, i) => ({ ...s, done: done[i] }))}
        current={PLANNER_STEPS.length - 1}
        onSelect={project ? (n) => navigate(plannerStepPath(n)) : undefined}
      />
      {project ? (
        <p role="status" className="flex items-center justify-end gap-2 text-meta text-muted-on-light">
          <Icon name={saving ? 'clock' : 'check'} size={16} />
          {saving ? 'Enregistrement…' : 'Enregistré'}
        </p>
      ) : null}
    </div>
  );
}

export default function PlannerCalendar() {
  const project = useCurrentProject();
  return (
    <div className="flex flex-col gap-8">
      <Link
        to={plannerStepPath(PLANNER_STEPS.length - 1)}
        className="no-print -mb-4 inline-flex min-h-11 items-center gap-2 self-start font-semibold underline-offset-4 hover:underline"
      >
        <Icon name="arrowLeft" size={18} />
        Retour
        <span className="sr-only">aux étapes de planification</span>
      </Link>
      <PageHeader
        eyebrow="Planifier · Calendrier"
        title="Calendrier de tournage"
        lead="Déplace une scène : horaires et rappels se mettent à jour."
      />
      <PlannerSteps project={project.data} />
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
