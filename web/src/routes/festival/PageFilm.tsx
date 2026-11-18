import { PageHeader } from '@/components/ui';
import { FilmPageEditor } from '@/features/festival/components/FilmPageEditor';
import { Breadcrumb, WithProject } from '@/features/festival/components/Kit';

export default function PageFilm() {
  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb items={[{ label: 'Mes dossiers', to: '/festival/dossiers' }, { label: 'Page film' }]} />
      <PageHeader
        title="Page film"
        lead="Photos du film, bande-annonce et dossier de presse en ligne : un lien à envoyer avec chaque candidature."
      />
      <WithProject>{(project) => <FilmPageEditor key={project.id} project={project} />}</WithProject>
    </div>
  );
}
