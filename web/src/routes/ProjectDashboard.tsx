import { PhasePlaceholder } from '@/components/layout/PhasePlaceholder';

export default function ProjectDashboard() {
  return (
    <PhasePlaceholder
      eyebrow="Tableau de bord"
      title="Mon projet"
      phase={4}
      lead="Prochain jour de tournage, avancement du planning, Passeport et dates limites."
    />
  );
}
