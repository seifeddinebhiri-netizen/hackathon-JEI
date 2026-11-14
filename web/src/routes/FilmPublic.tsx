import { useParams } from 'react-router';
import { PhasePlaceholder } from '@/components/layout/PhasePlaceholder';

export default function FilmPublic() {
  const { id } = useParams();
  return (
    <div className="container-pp py-12">
      <PhasePlaceholder eyebrow="Page film" title={id ?? 'Film'} phase={6} />
    </div>
  );
}
