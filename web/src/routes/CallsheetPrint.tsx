/**
 * Convocation d'une personne, prête à enregistrer en PDF : seulement ses scènes, ses heures de
 * rendez-vous et ses lieux (mêmes règles que l'e-mail). ?pdf=1 ouvre la boîte d'impression.
 */
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { api } from '@/api';
import type { CallsheetDraft, Project } from '@/api/types';
import { Button, ButtonLink, EmptyState, ErrorState, LoadingBlock } from '@/components/ui';
import { PrintLayout } from '@/app/layouts/PrintLayout';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { buildCallsheetInput } from '@/features/callsheets/lib';
import { useCurrentProject } from '@/features/project/hooks/useProject';
import { formatDate, formatDayLong } from '@/lib/format';
import { fileSlug, printAsPdf } from '@/lib/print';

const hour = (hhmm: string) => `${Number(hhmm.slice(0, 2))} h ${hhmm.slice(3, 5)}`;

function download(project: Project, draft: CallsheetDraft) {
  const first = draft.name.split(/\s+/)[0] || draft.name;
  printAsPdf(
    `${fileSlug(project.title)}_convocation_${fileSlug(first)}`,
    `${project.title} · Convocation de ${draft.name} · ${formatDate(new Date())}`,
  );
}

function Sheet({ project, draft }: { project: Project; draft: CallsheetDraft }) {
  const days = [...new Set(draft.scenes.map((s) => s.date))];
  return (
    <>
      <header className="border-b-[6px] border-ink pb-4">
        <p className="eyebrow">
          Convocation · {draft.role === 'acteur' ? 'Acteur ou actrice' : 'Équipe technique'}
        </p>
        <h1 className="mt-2 text-[36px] leading-none md:text-[44px]">{draft.name}</h1>
        <p className="mt-2 font-semibold">{project.title}</p>
        <p className="text-meta text-muted-on-light">
          {days.length} jour{days.length > 1 ? 's' : ''} de tournage · édité le {formatDate(new Date())}
        </p>
      </header>
      <ol className="mt-6 flex flex-col gap-6">
        {days.map((day) => {
          const items = draft.scenes.filter((s) => s.date === day);
          const call = items.map((s) => s.call_time).sort()[0];
          const places = [
            ...new Set(items.map((s) => (s.address ? `${s.location_name}, ${s.address}` : s.location_name))),
          ];
          return (
            <li key={day}>
              <div className="print-avoid">
                <h2 className="border-b-2 border-ink pb-1 text-h3 font-bold first-letter:uppercase">
                  {formatDayLong(day)}
                </h2>
                <p className="mt-2 inline-block bg-gold px-2 py-1 font-semibold text-ink">
                  Rendez-vous à {hour(call)}
                </p>
                <p className="mt-1 text-meta">{places.join(' / ')}</p>
              </div>
              <ul className="mt-2 flex flex-col">
                {items.map((s) => (
                  <li key={`${s.date}-${s.number}`} className="print-avoid border-b border-line-light py-2">
                    <p className="font-semibold">
                      Scène {s.number}
                      {s.title ? ` · ${s.title}` : ''}
                    </p>
                    <p className="text-meta">
                      {s.moment_label}
                      {s.start && s.end ? ` · de ${hour(s.start)} à ${hour(s.end)}` : ''}
                    </p>
                    {s.characters.length ? (
                      <p className="text-meta text-muted-on-light">Personnages : {s.characters.join(', ')}</p>
                    ) : null}
                    {s.notes ? <p className="text-meta">À savoir : {s.notes}</p> : null}
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ol>
    </>
  );
}

export default function CallsheetPrint() {
  const { memberId = '' } = useParams();
  const [params] = useSearchParams();
  const { user } = useAuth();
  const project = useCurrentProject();
  const member = project.data?.members?.find((m) => m.id === memberId);
  const preview = useQuery({
    queryKey: ['callsheet-fiche', project.data?.id, memberId, project.data?.schedule?.generated_at],
    enabled: !!project.data && !!member,
    queryFn: () =>
      api.previewCallsheets({
        ...buildCallsheetInput(project.data!, { directorName: user?.name ?? '', replyTo: '' }),
        members: [member!],
      }),
  });
  const draft = preview.data?.drafts[0];
  const printed = useRef(false);

  useEffect(() => {
    if (draft && project.data && params.get('pdf') === '1' && !printed.current) {
      printed.current = true;
      const p = project.data;
      void document.fonts.ready.then(() => download(p, draft));
    }
  }, [draft, project.data, params]);

  if (project.isPending || (preview.isPending && !!member))
    return <LoadingBlock lines={6} label="Préparation de la convocation…" />;
  if (project.isError) return <ErrorState error={project.error} onRetry={() => void project.refetch()} />;
  if (preview.isError) return <ErrorState error={preview.error} onRetry={() => void preview.refetch()} />;
  if (!member || !draft)
    return (
      <EmptyState
        icon="users"
        title="Pas de convocation pour cette personne"
        action={<ButtonLink to="/planner/convocations">Retour aux convocations</ButtonLink>}
      >
        {preview.data?.not_concerned[0]?.reason ?? 'Membre introuvable dans l’équipe.'}
      </EmptyState>
    );
  const p = project.data;
  return (
    <PrintLayout
      actions={
        <>
          <ButtonLink to="/planner/convocations" variant="ghost" icon="arrowLeft">
            Convocations
          </ButtonLink>
          <Button className="ml-auto" icon="download" onClick={() => download(p, draft)}>
            Télécharger en PDF
          </Button>
        </>
      }
    >
      <Sheet project={p} draft={draft} />
    </PrintLayout>
  );
}
