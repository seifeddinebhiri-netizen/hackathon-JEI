import { cn } from '@/lib/cn';

/** Bouton d'enregistrement rond, comme sur l'appareil photo : disque rouge, carré pendant la prise. */
export function RecordButton({ recording, onClick }: { recording: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={recording ? 'Arrêter l’enregistrement' : 'Démarrer l’enregistrement'}
      aria-pressed={recording}
      className="grid size-[72px] place-items-center rounded-full border-4 border-paper"
    >
      <span
        className={cn(
          'block bg-brand-red transition-all duration-150',
          recording ? 'size-7 rounded-sm' : 'size-14 rounded-full',
        )}
      />
    </button>
  );
}
