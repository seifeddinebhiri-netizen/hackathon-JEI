import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { ScheduleConflict } from '@/api/types';
import { Button, ButtonLink, Icon, StatusChip } from '@/components/ui';
import { CONFLICT_ICONS, CONFLICT_TONES } from '../../lib/labels';
import { CONFLICT_LABELS } from '../../lib/rules';
import type { ConflictGroup } from '../../lib/schedule';
import { useCalendar } from './context';

/** Libellé court du badge : texte + icône, jamais la couleur seule. */
const BADGE: Partial<Record<ScheduleConflict['kind'], string>> = {
  autorisation_manquante: 'À demander',
  lumiere_non_respectee: 'Lumière à revoir',
  meteo_a_reverifier: 'Météo à revoir',
};

const dayLabel = (iso: string) => format(parseISO(iso), 'EEE d MMM', { locale: fr });

/** Une carte par lieu : tous ses rappels (autorisation, lumière, météo…) au même endroit. */
type Card = { key: string; locationId?: string; groups: ConflictGroup[] };

function byLocation(groups: ConflictGroup[]): Card[] {
  const cards = new Map<string, Card>();
  for (const g of groups) {
    const key = g.locationId ?? g.key;
    const card = cards.get(key) ?? { key, locationId: g.locationId, groups: [] };
    card.groups.push(g);
    cards.set(key, card);
  }
  return [...cards.values()];
}

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
      <p className="flex items-center gap-2 rounded-lg border-2 border-ok-fg/40 bg-ok-bg p-3 font-semibold text-ok-fg">
        <Icon name="check" size={18} /> Aucun rappel : tout est prêt.
      </p>
    );
  const cards = byLocation(groups);
  return (
    <section aria-labelledby="conflits-titre">
      <h2 id="conflits-titre" className="eyebrow mb-3 flex items-center gap-1.5">
        <Icon name="alert" size={14} /> À régler ({cards.length})
      </h2>
      <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => {
          const loc = card.locationId ? locationById.get(card.locationId) : undefined;
          const permit = card.groups.find((g) => g.kind === 'autorisation_manquante');
          const light = card.groups.find((g) => g.kind === 'lumiere_non_respectee');
          const lightScene = light ? sceneById.get(light.sceneIds[0]) : undefined;
          // Changer de jour ne règle ni une autorisation ni une lumière
          const movable = card.groups
            .filter((g) => g.kind !== 'autorisation_manquante' && g.kind !== 'lumiere_non_respectee')
            .map((g) => ({ g, date: suggest(g) }))
            .find((x) => x.date);
          const title = loc?.name ?? CONFLICT_LABELS[card.groups[0].kind];
          return (
            <li
              key={card.key}
              className="flex flex-col gap-4 rounded-lg border-2 border-ink bg-white p-5 shadow-[0_2px_10px_rgb(18_17_16/0.08)]"
            >
              <div className="flex flex-col gap-2">
                <p className="font-display text-h3 leading-tight font-bold">{title}</p>
                <ul className="flex flex-wrap gap-2" aria-label={`Rappels pour ${title}`}>
                  {card.groups.map((g) => (
                    <li key={g.key}>
                      <StatusChip tone={CONFLICT_TONES[g.kind]} icon={CONFLICT_ICONS[g.kind]}>
                        {BADGE[g.kind] ?? CONFLICT_LABELS[g.kind]}
                        {g.date ? ` · ${dayLabel(g.date)}` : ''}
                      </StatusChip>
                    </li>
                  ))}
                  {loc?.permit === 'obtenue' ? (
                    <li>
                      <StatusChip tone="ok" icon="check">
                        Obtenue
                      </StatusChip>
                    </li>
                  ) : null}
                </ul>
                <p className="text-meta text-muted-on-light">
                  {[...new Set(card.groups.flatMap((g) => g.sceneIds))]
                    .map((id) => `Scène ${sceneById.get(id)?.number ?? '?'}`)
                    .join(', ')}
                </p>
              </div>

              <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2">
                {permit && card.locationId ? (
                  <Button
                    size="sm"
                    icon="check"
                    loading={busy}
                    onClick={() => onMarkPermit(card.locationId!)}
                  >
                    Marquer comme obtenue
                  </Button>
                ) : null}
                {movable?.date ? (
                  <Button
                    size="sm"
                    variant={permit ? 'ghost' : 'primary'}
                    icon="calendar"
                    loading={busy}
                    onClick={() => onMove(movable.g.sceneIds, movable.date!)}
                  >
                    Déplacer au {dayLabel(movable.date)}
                  </Button>
                ) : null}
                {lightScene ? (
                  <ButtonLink
                    to={`/planner/rapide?scene=${encodeURIComponent(lightScene.id)}`}
                    size="sm"
                    variant="ghost"
                    icon="clock"
                  >
                    Décaler à…
                  </ButtonLink>
                ) : null}
                {!permit && !movable && !lightScene ? (
                  <p className="text-meta text-muted-on-light">
                    {card.groups.some((g) => g.kind === 'meteo_a_reverifier')
                      ? 'À revérifier 14 jours avant.'
                      : 'Pas d’autre jour libre : ajuste à la main.'}
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
