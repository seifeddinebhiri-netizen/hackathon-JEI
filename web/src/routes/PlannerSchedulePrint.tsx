/**
 * Planning du tournage, prêt à imprimer ou à enregistrer en PDF (A4, texte sélectionnable).
 * ?pdf=1 ouvre directement la boîte d'impression (bouton « Télécharger en PDF » du calendrier).
 */
import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router';
import type { Project } from '@/api/types';
import { Button, ButtonLink, EmptyState, ErrorState, LoadingBlock } from '@/components/ui';
import { PrintLayout } from '@/app/layouts/PrintLayout';
import { MOMENT_LABELS } from '@/features/planner/lib/labels';
import { useCurrentProject } from '@/features/project/hooks/useProject';
import { formatDate, formatDayLong, formatHourFr } from '@/lib/format';
import { fileSlug, printAsPdf } from '@/lib/print';

function download(project: Project) {
  printAsPdf(
    `${fileSlug(project.title)}_planning`,
    `${project.title} · Planning au ${formatDate(new Date())}`,
  );
}

function Schedule({ project }: { project: Project }) {
  const days = project.schedule?.days ?? [];
  const sceneById = new Map(project.scenes.map((s) => [s.id, s]));
  const locById = new Map(project.locations.map((l) => [l.id, l]));
  return (
    <>
      <header className="border-b-[6px] border-ink pb-4">
        <p className="eyebrow">Planning du tournage</p>
        <h1 className="mt-2 text-[36px] leading-none md:text-[44px]">{project.title}</h1>
        <p className="mt-2 text-meta text-muted-on-light">
          {project.city} · {days.length} jour{days.length > 1 ? 's' : ''} · édité le {formatDate(new Date())}
        </p>
      </header>
      <ol className="mt-6 flex flex-col gap-6">
        {days.map((day, i) => {
          const places = [...new Set(day.location_ids.map((id) => locById.get(id)?.name).filter(Boolean))];
          return (
            <li key={day.date}>
              <h2 className="flex flex-wrap items-baseline gap-x-3 border-b-2 border-ink pb-1 text-h3 font-bold first-letter:uppercase">
                {formatDayLong(day.date)}
                <span className="text-meta font-normal text-muted-on-light">
                  Jour {i + 1} · Rendez-vous à {formatHourFr(`${day.date}T${day.call_time}`)}
                  {places.length ? ` · ${places.join(', ')}` : ''}
                </span>
              </h2>
              <ul className="mt-2 flex flex-col">
                {day.scenes.map((s) => {
                  const scene = sceneById.get(s.scene_id);
                  if (!scene) return null;
                  const loc = locById.get(scene.location_id);
                  return (
                    <li
                      key={s.scene_id}
                      className="print-avoid grid grid-cols-[88px_1fr] gap-x-4 border-b border-line-light py-2"
                    >
                      <p className="font-mono text-label">
                        {formatHourFr(s.start)}
                        <br />
                        <span className="text-muted-on-light">→ {formatHourFr(s.end)}</span>
                      </p>
                      <div>
                        <p className="font-semibold">
                          Scène {scene.number}
                          {scene.title ? ` · ${scene.title}` : ''}
                        </p>
                        <p className="text-meta">
                          {scene.setting === 'INT' ? 'Intérieur' : 'Extérieur'} ·{' '}
                          {MOMENT_LABELS[scene.moment]}
                          {loc ? ` · ${loc.name}${loc.address ? `, ${loc.address}` : ''}` : ''}
                        </p>
                        {scene.characters.length ? (
                          <p className="text-meta text-muted-on-light">
                            Avec : {scene.characters.join(', ')}
                          </p>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
              {day.backup_note ? (
                <p className="print-avoid mt-2 text-meta">Plan B : {day.backup_note}</p>
              ) : null}
            </li>
          );
        })}
      </ol>
    </>
  );
}

export default function PlannerSchedulePrint() {
  const project = useCurrentProject();
  const [params] = useSearchParams();
  const printed = useRef(false);
  const ready = !!project.data?.schedule?.days.length;

  useEffect(() => {
    if (ready && params.get('pdf') === '1' && !printed.current && project.data) {
      printed.current = true;
      const p = project.data;
      // Laisse le temps aux polices de se charger avant l'impression
      void document.fonts.ready.then(() => download(p));
    }
  }, [ready, params, project.data]);

  if (project.isPending) return <LoadingBlock lines={6} label="Chargement du planning…" />;
  if (project.isError) return <ErrorState error={project.error} onRetry={() => void project.refetch()} />;
  if (!ready)
    return (
      <EmptyState
        icon="calendar"
        title="Pas encore de planning"
        action={<ButtonLink to="/planner/calendrier">Aller au calendrier</ButtonLink>}
      />
    );
  const p = project.data;
  return (
    <PrintLayout
      actions={
        <>
          <ButtonLink to="/planner/calendrier" variant="ghost" icon="arrowLeft">
            Calendrier
          </ButtonLink>
          <Button className="ml-auto" icon="download" onClick={() => download(p)}>
            Télécharger en PDF
          </Button>
        </>
      }
    >
      <Schedule project={p} />
    </PrintLayout>
  );
}
