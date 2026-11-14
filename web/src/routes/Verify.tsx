import { useParams } from 'react-router';
import { PhasePlaceholder } from '@/components/layout/PhasePlaceholder';

export default function Verify() {
  const { id } = useParams();
  return (
    <div className="container-pp py-12">
      <PhasePlaceholder eyebrow="Vérification publique" title={`Passeport IA ${id ?? ''}`} phase={5} />
    </div>
  );
}
