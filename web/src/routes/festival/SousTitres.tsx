import { useSearchParams } from 'react-router';
import type { Project } from '@/api/types';
import { LoadingBlock, QueryState } from '@/components/ui';
import { Breadcrumb, WithProject } from '@/features/festival/components/Kit';
import { SubtitleImport } from '@/features/festival/components/SubtitleImport';
import { SubtitleViewer } from '@/features/festival/components/viewer/SubtitleViewer';
import { useFestival, useSubtitleDraft } from '@/features/festival/hooks/useFestivals';
import { shortName } from '@/features/festival/lib/kit';

/** Relecture des sous-titres : un seul écran, regarder et valider (ou importer le premier brouillon). */
function Page({ project }: { project: Project }) {
  const [params] = useSearchParams();
  const dossierId = params.get('dossier') ?? undefined;
  const festival = useFestival(dossierId);
  const draft = useSubtitleDraft(project.id);
  const lang = params.get('langue') === 'fr' ? 'français' : 'anglais';
  const crumbs = [
    { label: 'Mes dossiers', to: '/festival/dossiers' },
    ...(festival.data
      ? [
          {
            label: `Dossier ${shortName(festival.data)}`,
            to: `/festival/${encodeURIComponent(festival.data.id)}`,
          },
        ]
      : []),
    { label: `Sous-titres ${lang}` },
  ];
  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb items={crumbs} />
      <QueryState
        query={draft}
        loading={<LoadingBlock lines={10} label="Chargement des sous-titres…" />}
        errorTitle="Les sous-titres n’ont pas pu être chargés"
        isEmpty={(d) => d.lines.length === 0}
        empty={<SubtitleImport project={project} />}
      >
        {(d) => (
          <SubtitleViewer
            // Nouveau brouillon (« Refaire ») : la relecture repart de zéro
            key={d.processing?.created_at ?? d.project_id}
            project={project}
            draft={d}
            festivalLabel={festival.data ? shortName(festival.data) : undefined}
          />
        )}
      </QueryState>
    </div>
  );
}

export default function SousTitres() {
  return <WithProject>{(project) => <Page project={project} />}</WithProject>;
}
