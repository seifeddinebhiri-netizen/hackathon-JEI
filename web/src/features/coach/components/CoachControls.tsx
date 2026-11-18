import { Button } from '@/components/ui';
import { cn } from '@/lib/cn';
import { RecordButton } from './RecordButton';

const SHADOW = '[text-shadow:0_1px_6px_rgb(18_17_16/0.9)]';
const flat = cn('text-paper hover:bg-paper/10', SHADOW);

/** Bas de l'écran, façon appareil photo : réglages, bouton d'enregistrement, démo. Sans fond. */
export function CoachControls({
  demo,
  auto,
  recording,
  hasInstruction,
  lightInstruction,
  showWhy,
  onToggleAuto,
  onToggleRecord,
  onSettings,
  onFix,
  onWhy,
  onIgnore,
}: {
  /** Mode démo : affiche le bouton pause. */
  demo: boolean;
  auto: boolean;
  recording: boolean;
  hasInstruction: boolean;
  /** La consigne affichée concerne la lumière : proposer de la régler tout de suite. */
  lightInstruction: boolean;
  showWhy: boolean;
  onToggleAuto: () => void;
  onToggleRecord: () => void;
  onSettings: () => void;
  /** « Régler » : ouvre le réglage qui correspond à la consigne affichée. */
  onFix: () => void;
  onWhy: () => void;
  onIgnore: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      {hasInstruction ? (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className={flat} onClick={onWhy} aria-expanded={showWhy}>
            Pourquoi ?
          </Button>
          {lightInstruction ? (
            <Button variant="ghost" size="sm" className={cn(flat, 'font-bold underline')} onClick={onFix}>
              Régler
            </Button>
          ) : null}
          <Button variant="ghost" size="sm" className={flat} onClick={onIgnore}>
            Ignorer
          </Button>
        </div>
      ) : null}
      <div className="grid w-full grid-cols-3 items-center">
        <div className="flex justify-start">
          <Button variant="ghost" size="sm" className={flat} onClick={onSettings}>
            Réglages
          </Button>
        </div>
        <div className="flex justify-center">
          <RecordButton recording={recording} onClick={onToggleRecord} />
        </div>
        <div className="flex justify-end">
          {demo ? (
            <Button variant="ghost" size="sm" className={flat} onClick={onToggleAuto}>
              {auto ? 'Pause démo' : 'Reprendre'}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
