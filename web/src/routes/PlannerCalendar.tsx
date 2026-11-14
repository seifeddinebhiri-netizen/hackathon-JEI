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
import { useEffect, useMemo, useState } from 'react';
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
  useToast,
} from '@/components/ui';
import { ConflictPanel } from '@/features/planner/components/calendar/ConflictPanel';
import {
  CalendarContext,
  parseDropTarget,
  type CalendarCtx,
} from '@/features/planner/components/calendar/context';
import { DayRow } from '@/features/planner/components/calendar/DayRow';
import { TimeAxis } from '@/features/planner/components/calendar/DayTimeline';
import { FreeDaysRow } from '@/features/planner/components/calendar/FreeDaysRow';
import { snapToHHMM, SPAN, T0 } from '@/features/planner/components/calendar/geometry';
import { MobileDayCard } from '@/features/planner/components/calendar/MobileDayCard';
import { MoveDialog } from '@/features/planner/components/calendar/MoveDialog';
import { PeriodView } from '@/features/planner/components/calendar/PeriodView';
import { SceneChip } from '@/features/planner/components/calendar/SceneChip';
import { UnplacedTray } from '@/features/planner/components/calendar/UnplacedTray';
import { GenerateScheduleButton } from '@/features/planner/components/GenerateScheduleButton';
import { usePeriodWeather } from '@/features/planner/hooks/usePlanner';
import { useScheduleEditor } from '@/features/planner/hooks/useScheduleEditor';
import { jumpToDroppable } from '@/features/planner/lib/keyboard';
import { SCENE_KIND_LABELS, SCENE_KIND_SWATCH, type SceneKind } from '@/features/planner/lib/labels';
import { anchoredSlot, countConflicts } from '@/features/planner/lib/rules';
import { findScene, groupConflicts, scenesNotInSchedule } from '@/features/planner/lib/schedule';
import { useCurrentProject } from '@/features/project/hooks/useProject';
import { cn } from '@/lib/cn';
import { formatDayLong } from '@/lib/format';
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

function Legend() {
  return (
    <ul
      className="flex flex-wrap items-center gap-x-4 gap-y-1 text-meta text-muted-on-light"
      aria-label="Légende"
    >
      {(['int-jour', 'ext-jour', 'int-nuit', 'ext-nuit'] as SceneKind[]).map((k) => (
        <li key={k} className="inline-flex items-center gap-1.5">
          <span className={cn('inline-block h-4 w-6 border-l-[4px]', SCENE_KIND_SWATCH[k])} />{' '}
          {SCENE_KIND_LABELS[k]}
        </li>
      ))}
      <li className="inline-flex items-center gap-1.5">
        <span className="inline-block h-4 w-6 bg-gold-soft/70" /> aube
      </li>
      <li className="inline-flex items-center gap-1.5">
        <span className="inline-block h-4 w-6 bg-gold/35" /> heure dorée
      </li>
      <li className="inline-flex items-center gap-1.5">
        <span className="inline-block h-4 w-6 bg-ink/10" /> nuit
      </li>
    </ul>
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
    }),
    [project, schedule, weather.byDate, windowDates, activeId],
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
          description: 'Aube, heure dorée et nuit suivent la lumière du jour.',
        });
      return editor.move(sceneId, target.date);
    }
    const hours = T0 + ((rect.left - e.over.rect.left) / e.over.rect.width) * SPAN;
    editor.moveToTime(sceneId, target.date, snapToHHMM(hours, scene.estimated_hours));
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

          <div className="flex flex-wrap items-end justify-between gap-4">
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
            <div>
              <div className="sticky top-16 z-10 grid grid-cols-[240px_1fr] border-x-2 border-transparent bg-paper pt-2">
                <span className="eyebrow pl-3 text-muted-on-light">Jour</span>
                <div className="px-3">
                  <TimeAxis />
                </div>
              </div>
              <ol className="flex flex-col gap-2" aria-label="Jours de tournage">
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
                Glisse une scène sur la frise pour la poser à une heure précise (au quart d’heure), ou sur la
                date pour qu’elle prenne le premier créneau libre. Entrée sur une scène : détail et « Déplacer
                vers… ».
              </p>
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

export default function PlannerCalendar() {
  const project = useCurrentProject();
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Planifier · Calendrier"
        title="Calendrier de tournage"
        lead="Chaque jour de tournage sur une frise de 6 h à minuit, avec la lumière et la météo. Déplace les scènes : horaires et conflits sont recalculés."
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
