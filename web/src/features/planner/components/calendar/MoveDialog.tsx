import { useState } from 'react';
import { Button, Dialog, DialogContent, Field, Select } from '@/components/ui';
import { formatDayLong } from '@/lib/format';
import { isWeatherKnown, isRainy, isWindy, isForbiddenDay } from '../../lib/rules';
import { useCalendar } from './context';

/** Alternative accessible au glisser-déposer : choisir le jour dans une liste. */
export function MoveDialog({
  sceneId,
  currentDate,
  onClose,
  onMove,
}: {
  sceneId: string | null;
  currentDate: string | 'unplaced' | undefined;
  onClose: () => void;
  onMove: (sceneId: string, to: string | null) => void;
}) {
  const { sceneById, windowDates, weatherByDate, locationById } = useCalendar();
  const scene = sceneId ? sceneById.get(sceneId) : undefined;
  const [target, setTarget] = useState<string>('');
  const loc = scene ? locationById.get(scene.location_id) : undefined;

  const hint = (d: string) => {
    const w = weatherByDate.get(d);
    const notes: string[] = [];
    if (isForbiddenDay(loc, d)) notes.push('lieu fermé');
    if (scene?.setting === 'EXT') {
      if (!isWeatherKnown(w)) notes.push('météo à revérifier');
      else if (isRainy(w)) notes.push(`pluie ${w?.rain_pct} %`);
      else if (isWindy(w)) notes.push('vent fort');
    }
    return notes.length ? ` (${notes.join(', ')})` : '';
  };

  return (
    <Dialog
      open={!!scene}
      onOpenChange={(o) => {
        if (!o) {
          setTarget('');
          onClose();
        }
      }}
    >
      {scene ? (
        <DialogContent
          title={`Déplacer la scène ${scene.number}`}
          description={`${scene.title} · ${scene.setting} · le jour peut être à risque : le conflit sera signalé.`}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!target) return;
              onMove(scene.id, target === 'aucun' ? null : target);
              setTarget('');
              onClose();
            }}
            className="flex flex-col gap-5"
          >
            <Field label="Nouveau jour">
              <Select value={target} onChange={(e) => setTarget(e.target.value)} required>
                <option value="" disabled>
                  Choisir…
                </option>
                {windowDates.map((d) => (
                  <option key={d} value={d} disabled={d === currentDate}>
                    {formatDayLong(d)}
                    {hint(d)}
                    {d === currentDate ? ' · jour actuel' : ''}
                  </option>
                ))}
                <option value="aucun" disabled={currentDate === 'unplaced'}>
                  Retirer du planning (non placée)
                </option>
              </Select>
            </Field>
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={onClose}>
                Annuler
              </Button>
              <Button type="submit" disabled={!target} icon="calendar">
                Déplacer
              </Button>
            </div>
          </form>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}
