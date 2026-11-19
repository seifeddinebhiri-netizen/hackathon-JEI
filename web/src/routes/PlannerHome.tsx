import { Link } from 'react-router';
import { AiDraftBadge, ButtonLink, Card, Icon, PageHeader, QueryState, StatusChip } from '@/components/ui';
import { useCurrentProject } from '@/features/project/hooks/useProject';
import { countConflicts } from '@/features/planner/lib/rules';
import { formatDate, plural } from '@/lib/format';

export default function PlannerHome() {
  const project = useCurrentProject();

  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        eyebrow="Étape 1 · Planifier"
        title="Quand et où tourner"
        lead="Ton planning selon la lumière, la météo et tes lieux."
      />

      <Link
        to="/planner/projet"
        className="group flex flex-col justify-between gap-6 border-2 border-ink bg-ink p-6 text-paper transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard-gold md:flex-row md:items-center md:p-8"
      >
        <div className="flex items-start gap-5">
          <span className="grid size-12 shrink-0 place-items-center bg-brand-red text-white">
            <Icon name="calendar" size={24} />
          </span>
          <div>
            <h2 className="text-h2">Planifier mon tournage</h2>
            <p className="mt-2 text-muted-on-dark">Scénario, lieux, équipe, puis calendrier.</p>
          </div>
        </div>
        <span className="inline-flex min-h-11 items-center gap-2 font-semibold text-gold group-hover:underline">
          Commencer <Icon name="arrowRight" size={18} />
        </span>
      </Link>

      <section aria-labelledby="film-en-cours">
        <h2 id="film-en-cours" className="eyebrow mb-3 text-muted-on-light">
          Film en cours
        </h2>
        <QueryState query={project} errorTitle="Impossible de charger ton film">
          {(p) => {
            const placed = p.schedule?.days.reduce((n, d) => n + d.scenes.length, 0) ?? 0;
            const conflicts = p.schedule ? countConflicts(p.schedule.days).total : 0;
            return (
              <Card className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-display text-h3 font-bold">{p.title}</p>
                  <p className="mt-1 text-meta text-muted-on-light">
                    {p.format === 'court' ? 'Court métrage' : 'Long métrage'} · {p.city} · du{' '}
                    {formatDate(p.shooting_window.from)} au {formatDate(p.shooting_window.to)}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <StatusChip tone="neutral" icon="film">
                      {plural(p.scenes.length, 'scène', 'scènes')}
                    </StatusChip>
                    {p.schedule ? (
                      <>
                        <StatusChip tone={placed === p.scenes.length ? 'ok' : 'warn'} icon="calendar">
                          {placed}/{p.scenes.length} placées
                        </StatusChip>
                        <StatusChip tone={conflicts ? 'warn' : 'ok'}>
                          {plural(conflicts, 'conflit', 'conflits')}
                        </StatusChip>
                        {p.schedule.status === 'brouillon_ia' ? <AiDraftBadge /> : <AiDraftBadge validated />}
                      </>
                    ) : (
                      <StatusChip tone="warn" icon="calendar">
                        Pas encore de planning
                      </StatusChip>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  {p.schedule ? (
                    <ButtonLink to="/planner/calendrier" iconRight="arrowRight">
                      Ouvrir le calendrier
                    </ButtonLink>
                  ) : (
                    <ButtonLink to="/planner/projet?etape=5" iconRight="arrowRight">
                      Générer le planning
                    </ButtonLink>
                  )}
                  <ButtonLink to="/planner/projet?nouveau=1" variant="secondary" icon="plus">
                    Nouveau film
                  </ButtonLink>
                </div>
              </Card>
            );
          }}
        </QueryState>
      </section>
    </div>
  );
}
