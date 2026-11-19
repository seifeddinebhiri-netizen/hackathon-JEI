import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Link, useParams } from 'react-router';
import type { Project, Scene, ScheduledScene, ShootingDay } from '@/api/types';
import {
  AiDraftBadge,
  Button,
  ButtonLink,
  EmptyState,
  ErrorState,
  Icon,
  Select,
  LoadingBlock,
  StatusChip,
  useToast,
} from '@/components/ui';
import { PrintLayout } from '@/app/layouts/PrintLayout';
import { LogoImage } from '@/components/layout/Logo';
import {
  ConflictList,
  MomentTag,
  SettingTag,
  SunTimes,
  WeatherSummary,
} from '@/features/planner/components/Tags';
import { usePeriodWeather } from '@/features/planner/hooks/usePlanner';
import { useScheduleEditor } from '@/features/planner/hooks/useScheduleEditor';
import { PERMIT_LABELS } from '@/features/planner/lib/labels';
import { anchoredSlot } from '@/features/planner/lib/rules';
import { useCurrentProject } from '@/features/project/hooks/useProject';
import { cn } from '@/lib/cn';
import { formatDayLong, formatTime } from '@/lib/format';
import { copyToClipboard, fileSlug, printAsPdf } from '@/lib/print';

/** Heures de rendez-vous au quart d'heure, de 04:00 à 22:00 (format 24 h quel que soit le navigateur). */
const CALL_TIMES = Array.from({ length: (22 - 4) * 4 + 1 }, (_, i) => {
  const m = 4 * 60 + i * 15;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
});

function Section({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('print-avoid border-t-2 border-ink pt-4', className)}>
      <h2 className="eyebrow mb-3">{title}</h2>
      {children}
    </section>
  );
}

function SceneRow({
  s,
  scene,
  project,
  index,
}: {
  s: ScheduledScene;
  scene: Scene;
  project: Project;
  index: number;
}) {
  const anchored = !!anchoredSlot(scene, s.start.slice(0, 10), undefined);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: s.scene_id,
    disabled: anchored,
  });
  const loc = project.locations.find((l) => l.id === scene.location_id);
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'print-avoid grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 border-b-2 border-line-light py-3 md:grid-cols-[auto_120px_1fr]',
        isDragging && 'bg-gold-soft',
      )}
    >
      <div className="row-span-2 flex items-start">
        {anchored ? (
          <span
            className="no-print grid size-11 place-items-center text-muted-on-light"
            title="Horaire fixé par le soleil"
          >
            <Icon name="lock" size={16} />
            <span className="sr-only">Horaire fixé par le soleil</span>
          </span>
        ) : (
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="no-print grid size-11 cursor-grab touch-none place-items-center hover:bg-ink/5"
            aria-label={`Réordonner la scène ${scene.number}. Espace pour prendre, flèches pour déplacer.`}
          >
            <Icon name="grip" size={18} />
          </button>
        )}
        <span className="print-only font-mono">{index + 1}.</span>
      </div>
      <p className="font-mono text-label font-medium md:row-span-2">
        {formatTime(s.start)}
        <br />
        <span className="text-muted-on-light">→ {formatTime(s.end)}</span>
      </p>
      <div className="col-start-2 md:col-start-3 md:row-span-2">
        <p className="flex flex-wrap items-center gap-2">
          <span className="font-display text-[18px] font-bold">Sc. {scene.number}</span>
          <SettingTag setting={scene.setting} />
          <MomentTag moment={scene.moment} />
          <span className="font-semibold">{scene.title}</span>
        </p>
        {scene.summary ? <p className="mt-1 text-meta text-muted-on-light">{scene.summary}</p> : null}
        <p className="mt-1 text-meta">
          {loc ? <>{loc.name} · </> : null}
          {scene.characters.length ? scene.characters.join(', ') : 'Sans personnage'}
        </p>
        <ConflictList conflicts={s.conflicts} className="mt-2" />
        <ButtonLink
          to={`/planner/rapide?scene=${encodeURIComponent(scene.id)}`}
          variant="ghost"
          size="sm"
          icon="clock"
          className="no-print mt-1 -ml-3"
          aria-label={`Décaler la scène ${scene.number} à un autre créneau`}
        >
          Décaler à…
        </ButtonLink>
      </div>
    </li>
  );
}

function DaySheet({
  project,
  day,
  index,
  total,
}: {
  project: Project;
  day: ShootingDay;
  index: number;
  total: number;
}) {
  const weather = usePeriodWeather(project);
  const editor = useScheduleEditor(project, weather.byDate);
  const { toast } = useToast();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const schedule = project.schedule!;
  const days = schedule.days;
  const prev = days[index - 1];
  const next = days[index + 1];
  const w = weather.byDate.get(day.date) ?? day.weather;
  const locs = day.location_ids
    .map((id) => project.locations.find((l) => l.id === id))
    .filter((l): l is NonNullable<typeof l> => !!l);
  const sceneById = new Map(project.scenes.map((s) => [s.id, s]));
  const sceneObjs = day.scenes
    .map((s) => ({ s, scene: sceneById.get(s.scene_id) }))
    .filter((x): x is { s: ScheduledScene; scene: Scene } => !!x.scene);

  const characters = [...new Set(sceneObjs.flatMap((x) => x.scene.characters))];
  const actors = characters.map((c) => {
    const p = project.people.find((x) => x.kind === 'acteur' && x.character === c);
    const first = sceneObjs.find((x) => x.scene.characters.includes(c));
    return {
      character: c,
      person: p,
      first: first?.s.start,
      scenes: sceneObjs.filter((x) => x.scene.characters.includes(c)).map((x) => x.scene.number),
    };
  });
  const crew = project.people.filter((p) => p.kind === 'equipe');

  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const ids = day.scenes.map((s) => s.scene_id);
    const moved = arrayMove(ids, ids.indexOf(String(e.active.id)), ids.indexOf(String(e.over.id)));
    editor.reorder(day.date, moved);
  };

  const copy = async () => {
    const ok = await copyToClipboard(window.location.href);
    toast(
      ok
        ? { tone: 'ok', title: 'Lien copié', description: 'Il s’ouvre pour les membres connectés du projet.' }
        : {
            tone: 'bad',
            title: 'Copie impossible',
            description: 'Copie l’adresse depuis la barre du navigateur.',
          },
    );
  };

  return (
    <PrintLayout
      actions={
        <>
          <ButtonLink to="/planner/calendrier" variant="ghost" icon="arrowLeft">
            Calendrier
          </ButtonLink>
          <div className="ml-auto flex flex-wrap gap-3">
            <Button variant="secondary" icon="link" onClick={() => void copy()}>
              Copier le lien
            </Button>
            <Button
              icon="download"
              onClick={() =>
                printAsPdf(
                  `${fileSlug(project.title)}_feuille-de-service_${day.date}`,
                  `${project.title} · Feuille de service du ${formatDayLong(day.date)}`,
                )
              }
            >
              Télécharger en PDF
            </Button>
          </div>
        </>
      }
    >
      <header className="grid grid-cols-1 gap-4 border-b-[6px] border-ink pb-4 sm:grid-cols-[1fr_auto] sm:items-start">
        <div>
          <p className="eyebrow">
            Feuille de service · Jour {index + 1} sur {total}
          </p>
          <h1 className="mt-2 text-[36px] leading-none first-letter:uppercase md:text-[44px]">
            {formatDayLong(day.date)}
          </h1>
          <p className="mt-2 font-semibold">{project.title}</p>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <AiDraftBadge validated={schedule.status === 'valide'} className="no-print" />
          <label className="flex flex-col items-start gap-1 border-2 border-ink bg-gold-soft p-3 sm:items-end print:bg-white">
            <span className="eyebrow">Rendez-vous de l’équipe</span>
            <span className="no-print w-36">
              <Select
                value={day.call_time}
                onChange={(e) => editor.setCallTime(day.date, e.target.value)}
                className="font-display text-[22px] font-bold"
                aria-describedby="rdv-aide"
              >
                {CALL_TIMES.includes(day.call_time) ? null : (
                  <option value={day.call_time}>{day.call_time}</option>
                )}
                {CALL_TIMES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </span>
            <span className="print-only font-display text-[28px] font-bold">{day.call_time}</span>
            <span id="rdv-aide" className="no-print text-label text-muted-on-light">
              Recalculé si les scènes du jour changent
            </span>
          </label>
        </div>
      </header>

      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-3 [&>section]:border-t-0 [&>section]:pt-0">
        <Section title="Lieu" className="md:col-span-1">
          {locs.map((l) => (
            <div key={l.id} className="mb-2">
              <p className="font-semibold">{l.name}</p>
              <p className="text-meta">{l.address || 'Adresse à compléter'}</p>
              {l.access_hours ? (
                <p className="text-meta text-muted-on-light">
                  Accès {l.access_hours.from}–{l.access_hours.to}
                </p>
              ) : null}
            </div>
          ))}
        </Section>
        <Section title="Soleil">
          <SunTimes weather={w} />
          {w ? (
            <p className="mt-1 flex items-center gap-1 text-meta">
              <Icon name="golden" size={16} /> Lumière du soir {formatTime(w.golden_hour.from)}–
              {formatTime(w.golden_hour.to)}
            </p>
          ) : null}
        </Section>
        <Section title="Météo prévue">
          <WeatherSummary weather={w} />
          {w?.forecast === 'hors_horizon' ? (
            <p className="mt-1 text-meta text-muted-on-light">Prévision disponible environ 14 jours avant.</p>
          ) : null}
        </Section>
      </div>

      {day.backup_note ? (
        <p className="mt-6 flex items-start gap-2 border-2 border-ink bg-gold-soft p-3 text-meta print:bg-white">
          <Icon name="info" size={16} className="mt-0.5 shrink-0" />{' '}
          <span>
            <strong>Repli : </strong>
            {day.backup_note}
          </span>
        </p>
      ) : null}

      <Section title={`Ordre des scènes (${sceneObjs.length})`} className="mt-6">
        <p className="no-print mb-2 text-meta text-muted-on-light">
          Glisse la poignée pour réordonner. Les scènes liées au soleil restent fixes.
        </p>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={day.scenes.map((s) => s.scene_id)} strategy={verticalListSortingStrategy}>
            <ol>
              {sceneObjs.map((x, i) => (
                <SceneRow key={x.s.scene_id} s={x.s} scene={x.scene} project={project} index={i} />
              ))}
            </ol>
          </SortableContext>
        </DndContext>
      </Section>

      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
        <Section title={`Acteurs convoqués (${actors.length})`}>
          <ul className="flex flex-col gap-2">
            {actors.map((a) => (
              <li
                key={a.character}
                className="flex flex-col gap-0.5 text-meta sm:flex-row sm:items-baseline sm:justify-between sm:gap-2"
              >
                <span>
                  <strong>{a.character}</strong> ·{' '}
                  {a.person?.name || <span className="text-warn-fg">acteur à distribuer</span>}
                  {a.person?.contact ? (
                    <span className="text-muted-on-light"> · {a.person.contact}</span>
                  ) : null}
                </span>
                <span className="font-mono text-label">
                  Sc. {a.scenes.join(', ')}
                  {a.first ? ` · 1re à ${formatTime(a.first)}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </Section>
        <Section title={`Équipe (${crew.length})`}>
          <ul className="flex flex-col gap-2">
            {crew.map((p) => (
              <li key={p.id} className="flex flex-wrap justify-between gap-2 text-meta">
                <span>
                  <strong>{p.role}</strong> · {p.name || 'à compléter'}
                </span>
                {p.contact ? <span className="text-muted-on-light">{p.contact}</span> : null}
              </li>
            ))}
            {crew.length === 0 ? (
              <li className="text-meta text-muted-on-light">Aucune personne dans l’équipe.</li>
            ) : null}
          </ul>
          <p className="mt-2 text-meta text-muted-on-light">
            Toute l’équipe au rendez-vous à {day.call_time}.
          </p>
        </Section>
      </div>

      <Section title="Notes" className="mt-6">
        <ul className="flex flex-col gap-2 text-meta">
          {locs.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center gap-2">
              <strong>{l.name} :</strong>
              <StatusChip
                tone={l.permit === 'a_demander' ? 'warn' : l.permit === 'obtenue' ? 'ok' : 'neutral'}
                icon="doc"
              >
                Autorisation {PERMIT_LABELS[l.permit].toLowerCase()}
              </StatusChip>
              {l.notes ? <span>{l.notes}</span> : null}
            </li>
          ))}
        </ul>
      </Section>

      <footer className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t-2 border-ink pt-4 text-meta">
        <span className="flex items-center gap-3 text-muted-on-light">
          <LogoImage onDark={false} height={28} />
          {schedule.status === 'valide' ? 'Planning validé' : 'Brouillon IA : à valider'}
        </span>
        <nav aria-label="Autres jours" className="no-print flex gap-2">
          {prev ? (
            <Link
              to={`/planner/jour/${prev.date}`}
              className="inline-flex min-h-11 items-center gap-1 border-2 border-ink px-3 font-semibold"
            >
              <Icon name="chevronLeft" size={16} /> Jour {index}
            </Link>
          ) : null}
          {next ? (
            <Link
              to={`/planner/jour/${next.date}`}
              className="inline-flex min-h-11 items-center gap-1 border-2 border-ink px-3 font-semibold"
            >
              Jour {index + 2} <Icon name="chevronRight" size={16} />
            </Link>
          ) : null}
        </nav>
      </footer>
    </PrintLayout>
  );
}

export default function PlannerDay() {
  const { date } = useParams();
  const project = useCurrentProject();
  if (project.isPending) return <LoadingBlock lines={10} label="Chargement de la feuille de service…" />;
  if (project.isError) return <ErrorState error={project.error} onRetry={() => void project.refetch()} />;
  const days = project.data.schedule?.days ?? [];
  const index = days.findIndex((d) => d.date === date);
  if (index < 0) {
    return (
      <EmptyState
        icon="calendar"
        title="Pas de tournage ce jour-là"
        action={
          <ButtonLink to="/planner/calendrier" iconRight="arrowRight">
            Ouvrir le calendrier
          </ButtonLink>
        }
      >
        {date ? `Aucune scène n’est prévue le ${date}.` : 'Date manquante.'} Choisis un jour de tournage dans
        le calendrier.
      </EmptyState>
    );
  }
  return <DaySheet project={project.data} day={days[index]} index={index} total={days.length} />;
}
