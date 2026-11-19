import { Link } from 'react-router';
import type { Project } from '@/api/types';
import {
  AiDraftBadge,
  ButtonLink,
  Countdown,
  EmptyState,
  ErrorState,
  Icon,
  LoadingBlock,
  PageHeader,
  Skeleton,
  StatusChip,
} from '@/components/ui';
import { useShortlistFestivals } from '@/features/festival/hooks/useFestivals';
import { useProjectPassport } from '@/features/passport/hooks/usePassport';
import { DEPARTMENTS, summarize } from '@/features/passport/lib/labels';
import { SunTimes, WeatherSummary } from '@/features/planner/components/Tags';
import { usePeriodWeather } from '@/features/planner/hooks/usePlanner';
import { CONFLICT_ICONS } from '@/features/planner/lib/labels';
import { CONFLICT_LABELS, countConflicts } from '@/features/planner/lib/rules';
import { useKit, withKit } from '@/features/festival/hooks/useKit';
import { useCurrentProject } from '@/features/project/hooks/useProject';
import { projectTodos } from '@/features/project/lib/todos';
import { cn } from '@/lib/cn';
import { daysUntil, formatDate, formatDayLong, isoDay } from '@/lib/format';

function Panel({
  title,
  icon,
  children,
  action,
  dark,
  className,
}: {
  title: string;
  icon: Parameters<typeof Icon>[0]['name'];
  children: React.ReactNode;
  action?: React.ReactNode;
  dark?: boolean;
  className?: string;
}) {
  return (
    <section
      aria-label={title}
      className={cn(
        'flex flex-col gap-4 border-2 border-ink p-5 md:p-6',
        dark ? 'bg-ink text-paper shadow-hard-gold [&_.text-muted-on-light]:text-muted-on-dark' : 'bg-white',
        className,
      )}
    >
      <h2 className={cn('eyebrow flex items-center gap-2', dark && 'text-gold')}>
        <Icon name={icon} size={16} /> {title}
      </h2>
      <div className="flex-1">{children}</div>
      {action ? <div className="flex flex-wrap gap-2">{action}</div> : null}
    </section>
  );
}

function NextDay({ project }: { project: Project }) {
  const weather = usePeriodWeather(project);
  const today = isoDay(new Date());
  const days = project.schedule?.days ?? [];
  const next = days.find((d) => d.date >= today);
  if (!project.schedule)
    return (
      <Panel
        title="Prochain jour de tournage"
        icon="calendar"
        action={
          <ButtonLink to="/planner/projet?etape=5" size="sm" iconRight="arrowRight">
            Générer le planning
          </ButtonLink>
        }
      >
        <p className="text-muted-on-light">Pas encore de planning.</p>
      </Panel>
    );
  if (!next)
    return (
      <Panel title="Prochain jour de tournage" icon="calendar">
        <p className="text-muted-on-light">Tous les jours de tournage sont passés.</p>
      </Panel>
    );
  const index = days.indexOf(next);
  const w = weather.byDate.get(next.date) ?? next.weather;
  const locs = next.location_ids
    .map((id) => project.locations.find((l) => l.id === id)?.name)
    .filter(Boolean);
  const d = daysUntil(next.date);
  return (
    <Panel
      title="Prochain jour de tournage"
      icon="calendar"
      dark
      action={
        <ButtonLink to={`/planner/jour/${next.date}`} size="sm" iconRight="arrowRight">
          Feuille de service
        </ButtonLink>
      }
    >
      <p className="eyebrow text-gold">
        Jour {index + 1} sur {days.length} ·{' '}
        {d === 0 ? 'aujourd’hui' : d === 1 ? 'demain' : `dans ${d} jours`}
      </p>
      <p className="mt-2 font-display text-h2 leading-tight font-bold first-letter:uppercase">
        {formatDayLong(next.date)}
      </p>
      <p className="mt-2">
        RDV {next.call_time} · {locs.join(', ')} · {next.scenes.length} scène
        {next.scenes.length > 1 ? 's' : ''}
      </p>
      <div className="mt-4 flex flex-col gap-2 border-t border-line-dark pt-4 [&_.text-bad-fg]:text-gold [&_.text-warn-fg]:text-gold">
        {weather.isPending && !w ? (
          <Skeleton className="h-4 w-1/2 bg-line-dark" />
        ) : (
          <WeatherSummary weather={w} />
        )}
        <SunTimes weather={w} />
      </div>
    </Panel>
  );
}

function PlanningProgress({ project }: { project: Project }) {
  const s = project.schedule;
  const placed = s?.days.reduce((n, d) => n + d.scenes.length, 0) ?? 0;
  const total = project.scenes.length;
  const pct = total ? Math.round((placed / total) * 100) : 0;
  const { total: conflicts, byKind } = countConflicts(s?.days ?? []);
  return (
    <Panel
      title="Avancement du planning"
      icon="film"
      action={
        <ButtonLink
          to={s ? '/planner/calendrier' : '/planner'}
          size="sm"
          variant="secondary"
          iconRight="arrowRight"
        >
          {s ? 'Calendrier' : 'Planifier'}
        </ButtonLink>
      }
    >
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-display text-[40px] leading-none font-bold">
          {placed}
          <span className="text-h3 text-muted-on-light">/{total}</span>
        </p>
        {s ? <AiDraftBadge validated={s.status === 'valide'} /> : null}
      </div>
      <p className="mt-1 text-meta text-muted-on-light">scènes placées sur {s?.days.length ?? 0} jours</p>
      <div
        className="mt-3 h-3 border-2 border-ink"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Scènes placées"
      >
        <div className="h-full bg-ink" style={{ width: `${pct}%` }} />
      </div>
      <ul className="mt-4 flex flex-col gap-1.5">
        {conflicts === 0 ? (
          <li className="flex items-center gap-1.5 text-meta text-ok-fg">
            <Icon name="check" size={16} /> Aucun conflit
          </li>
        ) : (
          Object.entries(byKind).map(([k, n]) => (
            <li key={k} className="flex items-center gap-1.5 text-meta">
              <Icon name={CONFLICT_ICONS[k as keyof typeof CONFLICT_ICONS]} size={16} />
              {n} × {CONFLICT_LABELS[k as keyof typeof CONFLICT_LABELS]}
            </li>
          ))
        )}
      </ul>
    </Panel>
  );
}

function PassportProgress({ project }: { project: Project }) {
  const q = useProjectPassport(project.id);
  const declared = q.data?.declarations.length ?? 0;
  const c = q.data ? summarize(q.data.declarations) : null;
  return (
    <Panel
      title="Passeport IA"
      icon="shield"
      action={
        <ButtonLink to="/passeport" size="sm" variant="secondary" iconRight="arrowRight">
          {q.data ? 'Ouvrir le Passeport' : 'Commencer la déclaration'}
        </ButtonLink>
      }
    >
      {q.isPending ? (
        <Skeleton className="h-16 w-full" />
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : (
        <>
          <p className="font-display text-[40px] leading-none font-bold">
            {declared}
            <span className="text-h3 text-muted-on-light">/{DEPARTMENTS.length}</span>
          </p>
          <p className="mt-1 text-meta text-muted-on-light">départements déclarés</p>
          {c ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <StatusChip tone="neutral" icon="user">
                {c.humain} humain{c.humain > 1 ? 's' : ''}
              </StatusChip>
              <StatusChip tone="neutral" icon="users">
                {c.assiste} assisté{c.assiste > 1 ? 's' : ''}
              </StatusChip>
              <StatusChip tone="neutral" icon="sparkle">
                {c.genere} généré{c.genere > 1 ? 's' : ''}
              </StatusChip>
            </div>
          ) : null}
          {q.data?.c2pa_signed ? (
            <p className="mt-3 flex items-center gap-1.5 text-meta text-ok-fg">
              <Icon name="check" size={16} /> Fichier final signé
            </p>
          ) : null}
        </>
      )}
    </Panel>
  );
}

function Deadlines({ project }: { project: Project }) {
  const ids = project.festival_shortlist.map((f) => f.festival_id);
  const q = useShortlistFestivals(ids);
  // Seulement les appels ouverts, la date la plus proche d'abord
  const list = (q.data?.festivals ?? [])
    .filter((f): f is typeof f & { deadline: string } => f.deadline_status === 'ouverte' && !!f.deadline)
    .sort((a, b) => a.deadline.localeCompare(b.deadline))
    .slice(0, 3);
  return (
    <Panel
      title="Prochaines dates limites"
      icon="clock"
      action={
        <ButtonLink
          to={ids.length ? '/festival/dossiers' : '/festival'}
          size="sm"
          variant="secondary"
          iconRight="arrowRight"
        >
          {ids.length ? 'Mes dossiers' : 'Trouver un festival'}
        </ButtonLink>
      }
    >
      {!ids.length ? (
        <p className="text-muted-on-light">Aucun festival dans ta sélection pour l’instant.</p>
      ) : q.isPending ? (
        <Skeleton className="h-16 w-full" />
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : !list.length ? (
        <p className="text-muted-on-light">Aucun appel ouvert dans tes dossiers.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line-light">
          {list.map((f) => (
            <li key={f.id} className="flex items-center justify-between gap-3 py-2">
              <span>
                <span className="block font-semibold">{f.name}</span>
                <span className="text-meta text-muted-on-light">{formatDate(f.deadline)}</span>
              </span>
              <Countdown date={f.deadline} />
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function Todos({ project }: { project: Project }) {
  const passport = useProjectPassport(project.id);
  const todos = projectTodos(project, passport.data);
  return (
    <Panel title={`À faire (${todos.length})`} icon="check">
      {todos.length === 0 ? (
        <p className="flex items-center gap-1.5 text-ok-fg">
          <Icon name="check" size={18} /> Tout est à jour.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-line-light">
          {todos.map((t) => (
            <li key={t.id}>
              <Link to={t.to} className="group flex min-h-11 items-center gap-3 py-2">
                <span
                  className={cn(
                    'grid size-8 shrink-0 place-items-center border-2',
                    t.tone === 'bad'
                      ? 'border-bad-fg bg-bad-bg text-bad-fg'
                      : t.tone === 'warn'
                        ? 'border-warn-fg bg-warn-bg text-warn-fg'
                        : 'border-ink',
                  )}
                >
                  <Icon name={t.icon} size={16} />
                </span>
                <span className="flex-1 group-hover:underline">{t.label}</span>
                <Icon name="chevronRight" size={16} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

export default function ProjectDashboard() {
  const project = useCurrentProject();
  // Dossiers et champs du film : lus dans le Kit Festival (vides tant qu'il n'est pas chargé)
  const kit = useKit(project.data?.id);
  if (project.isPending)
    return (
      <div className="flex flex-col gap-8">
        <LoadingBlock lines={2} label="Chargement du projet…" />
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-56" />
          ))}
        </div>
      </div>
    );
  if (project.isError) {
    return (
      <EmptyState
        icon="film"
        title="Aucun film ouvert"
        action={
          <ButtonLink to="/planner/projet?nouveau=1" icon="plus">
            Créer un film
          </ButtonLink>
        }
      >
        {project.error.message} Crée un nouveau film pour commencer.
      </EmptyState>
    );
  }
  const p = withKit(project.data, kit.data ?? { project_id: project.data.id, dossiers: [], pieces: {} });
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow={`Tableau de bord · ${p.format === 'court' ? 'Court métrage' : 'Long métrage'}`}
        title={p.title}
        lead={`${p.city} · tournage possible du ${formatDate(p.shooting_window.from)} au ${formatDate(p.shooting_window.to)}`}
        actions={
          <ButtonLink to="/planner/projet?nouveau=1" variant="secondary" icon="plus">
            Nouveau film
          </ButtonLink>
        }
      />
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        <NextDay project={p} />
        <PlanningProgress project={p} />
        <PassportProgress project={p} />
        <Todos project={p} />
        <Deadlines project={p} />
      </div>
    </div>
  );
}
