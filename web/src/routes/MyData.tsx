import { PhasePlaceholder } from '@/components/layout/PhasePlaceholder';

export default function MyData() {
  return (
    <PhasePlaceholder
      eyebrow="Compte"
      title="Mes données"
      phase={7}
      lead="Ce qui est stocké, ce qui ne l'est pas. Exporter ou supprimer."
    />
  );
}
