import { Icon } from '@/components/ui';
import { cn } from '@/lib/cn';
import { CHECKS, type CheckId, type Readings } from '../checks';

/**
 * Petits voyants, sans fond : vert (✓) = bon, rouge (✕) = à corriger, anneau vide (–) = pas
 * mesuré. La forme dans le point double la couleur. Le nom du contrôle est lu par les lecteurs
 * d'écran et écrit dans la consigne.
 */
export function CheckDots({
  readings,
  unmeasured,
  notApplicable,
  interactive,
  onToggle,
}: {
  readings: Readings;
  /** Contrôles sans mesure (visage absent, capteur indisponible...) : jamais présentés comme « bons ». */
  unmeasured: ReadonlySet<CheckId>;
  /** Contrôles sans objet pour ce plan (plan en mouvement...) : affichés comme les non mesurés, nommés « sans objet ». */
  notApplicable: ReadonlySet<CheckId>;
  /** Démo seulement : toucher un voyant le fait passer du vert au rouge. */
  interactive: boolean;
  onToggle: (id: CheckId) => void;
}) {
  return (
    <ul className="flex items-center justify-center" aria-label="Contrôles du cadre">
      {CHECKS.map((c) => {
        const na = notApplicable.has(c.id);
        const missing = na || unmeasured.has(c.id);
        const ok = readings[c.id].ok;
        const state = na ? 'sans objet pour ce plan' : missing ? 'non mesuré' : ok ? 'correct' : 'à corriger';
        const dot = (
          <span
            className={cn(
              'grid size-4 place-items-center rounded-full ring-1',
              missing
                ? 'text-paper/80 ring-paper/70'
                : ok
                  ? 'bg-live-ok text-ink ring-ink/70'
                  : 'bg-brand-red text-white ring-ink/70',
            )}
          >
            <Icon name={missing ? 'minus' : ok ? 'check' : 'x'} size={10} />
          </span>
        );
        return (
          <li key={c.id}>
            {interactive ? (
              <button
                type="button"
                onClick={() => onToggle(c.id)}
                aria-label={`${c.label} : ${state}. Toucher pour changer (démonstration).`}
                className="grid h-11 w-7 place-items-center"
              >
                {dot}
              </button>
            ) : (
              <span
                role="img"
                aria-label={`${c.label} : ${state}`}
                className="grid h-11 w-7 place-items-center"
              >
                {dot}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
