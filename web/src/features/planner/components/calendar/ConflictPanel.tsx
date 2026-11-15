import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Button, Icon } from '@/components/ui';
import { cn } from '@/lib/cn';
import { CONFLICT_ICONS, CONFLICT_TONES } from '../../lib/labels';
import { CONFLICT_LABELS } from '../../lib/rules';
import type { ConflictGroup } from '../../lib/schedule';
import { useCalendar } from './context';

const TONE_BORDER = {
  bad: 'border-bad-fg',
  warn: 'border-warn-fg',
  ok: 'border-ok-fg',
  neutral: 'border-ink',
  gold: 'border-ink',
  dark: 'border-ink',
  red: 'border-ink',
};

/** Conflits regroupés par cause et par lieu, chacun avec une action. */
export function ConflictPanel({
  groups,
  suggest,
  onMarkPermit,
  onMove,
  busy,
}: {
  groups: ConflictGroup[];
  suggest: (g: ConflictGroup) => string | undefined;
  onMarkPermit: (locationId: string) => void;
  onMove: (sceneIds: string[], date: string) => void;
  busy?: boolean;
}) {
  const { locationById, sceneById } = useCalendar();
  if (!groups.length)
    return (
      <p className="flex items-center gap-2 border-2 border-ok-fg/40 bg-ok-bg p-3 font-semibold text-ok-fg">
        <Icon name="check" size={18} /> Aucun conflit dans le planning.
      </p>
    );
  return (
    <section aria-labelledby="conflits-titre">
      <h2 id="conflits-titre" className="eyebrow mb-2 flex items-center gap-1.5">
        <Icon name="alert" size={14} /> À régler ({groups.length})
      </h2>
      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {groups.map((g) => {
          const loc = g.locationId ? locationById.get(g.locationId) : undefined;
          const n = g.sceneIds.length;
          const scenesTxt = g.sceneIds.map((id) => `Sc. ${sceneById.get(id)?.number}`).join(', ');
          // Changer de jour ne règle ni une autorisation ni une lumière : ces deux-là ont leur propre action
          const date =
            g.kind === 'autorisation_manquante' || g.kind === 'lumiere_non_respectee'
              ? undefined
              : suggest(g);
          const when = g.date ? ` · ${format(parseISO(g.date), 'EEE d MMM', { locale: fr })}` : '';
          return (
            <li
              key={g.key}
              className={cn(
                'flex flex-col gap-2 border-2 border-l-[6px] bg-white p-3',
                TONE_BORDER[CONFLICT_TONES[g.kind]],
              )}
            >
              <p className="flex items-start gap-2">
                <Icon name={CONFLICT_ICONS[g.kind]} size={18} className="mt-0.5 shrink-0" />
                <span>
                  <span className="block font-semibold">{loc ? loc.name : CONFLICT_LABELS[g.kind]}</span>
                  <span className="block text-meta">
                    {loc ? CONFLICT_LABELS[g.kind] : ''}
                    {loc ? ' · ' : ''}
                    {n} scène{n > 1 ? 's' : ''}
                    {when}
                  </span>
                  <span className="block text-meta text-muted-on-light">{scenesTxt}</span>
                </span>
              </p>
              <div className="mt-auto">
                {g.kind === 'autorisation_manquante' && g.locationId ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    icon="check"
                    loading={busy}
                    onClick={() => onMarkPermit(g.locationId!)}
                  >
                    Marquer comme obtenue
                  </Button>
                ) : date ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    icon="calendar"
                    loading={busy}
                    onClick={() => onMove(g.sceneIds, date)}
                  >
                    Déplacer au {format(parseISO(date), 'EEE d MMM', { locale: fr })} ?
                  </Button>
                ) : g.kind === 'lumiere_non_respectee' ? (
                  <p className="text-meta text-muted-on-light">
                    Utilise « Décaler à… » sous la scène pour la tourner dans sa lumière.
                  </p>
                ) : g.kind === 'meteo_a_reverifier' ? (
                  <p className="text-meta text-muted-on-light">
                    Prévision disponible environ 14 jours avant : à revérifier.
                  </p>
                ) : (
                  <p className="text-meta text-muted-on-light">
                    Aucun autre jour libre sans conflit : ajuste à la main.
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
