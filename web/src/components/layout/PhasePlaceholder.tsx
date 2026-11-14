import { EmptyState, PageHeader } from '@/components/ui';

/** Écran provisoire : remplacé à la phase indiquée. */
export function PhasePlaceholder({
  eyebrow,
  title,
  lead,
  phase,
}: {
  eyebrow: string;
  title: string;
  lead?: string;
  phase: number;
}) {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader eyebrow={eyebrow} title={title} lead={lead} />
      <EmptyState icon="layers" title={`Écran prévu en phase ${phase}`}>
        La route, la navigation et la couche de données sont en place. Le contenu arrive avec la phase {phase}
        .
      </EmptyState>
    </div>
  );
}
