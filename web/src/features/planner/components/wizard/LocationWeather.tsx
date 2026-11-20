import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { Location, Project, Scene } from '@/api/types';
import { Button, Icon, Skeleton } from '@/components/ui';
import { cn } from '@/lib/cn';
import { useLocationWeather } from '../../hooks/usePlanner';
import { weatherInWords } from '../../lib/labels';
import { weatherVerdict } from './weatherVerdict';

/**
 * Météo prévue à ce lieu, jour par jour, pendant la période de tournage, et ce qu'elle implique
 * pour les scènes du décor. Si elle menace des scènes en extérieur : les meilleurs jours, et des
 * lieux abrités à la place.
 */
export function LocationWeather({
  project,
  location,
  scenes,
  onShelteredPlaces,
}: {
  project: Project;
  location: Location;
  scenes: Scene[];
  onShelteredPlaces: () => void;
}) {
  const { from, to } = project.shooting_window;
  const weather = useLocationWeather(location.lat, location.lon, from, to);
  const hasExterior = scenes.some((s) => s.setting === 'EXT');
  const period = `du ${format(parseISO(from), 'd MMMM', { locale: fr })} au ${format(parseISO(to), 'd MMMM', { locale: fr })}`;

  return (
    <section aria-label="Météo pendant le tournage" className="mt-4 border-2 border-line-light bg-white p-4">
      <h4 className="flex items-center gap-2 text-body">
        <Icon name="sun" size={18} /> Météo pendant le tournage
        <span className="text-meta font-normal text-muted-on-light">· {period}</span>
      </h4>

      {location.lat === undefined || location.lon === undefined ? (
        <p className="mt-2 text-meta text-muted-on-light">
          Localise ce lieu, ou choisis-en un parmi les propositions, pour voir la météo prévue à cet endroit
          pendant le tournage.
        </p>
      ) : weather.isPending ? (
        <div role="status" className="mt-2 flex flex-col gap-2">
          <span className="text-meta text-muted-on-light">Chargement de la météo…</span>
          <Skeleton className="h-14" />
        </div>
      ) : weather.isError ? (
        <p
          role="alert"
          className="mt-2 flex flex-wrap items-center gap-2 text-meta font-semibold text-bad-fg"
        >
          <Icon name="alert" size={16} /> Météo indisponible pour le moment.
          <Button size="sm" variant="ghost" onClick={() => void weather.refetch()}>
            Réessayer
          </Button>
        </p>
      ) : (
        <WeatherDays days={weather.data} hasExterior={hasExterior} onShelteredPlaces={onShelteredPlaces} />
      )}
    </section>
  );
}

function WeatherDays({
  days,
  hasExterior,
  onShelteredPlaces,
}: {
  days: NonNullable<ReturnType<typeof useLocationWeather>['data']>;
  hasExterior: boolean;
  onShelteredPlaces: () => void;
}) {
  const verdict = weatherVerdict(days, hasExterior);
  const bad = new Set(verdict.bad.map((d) => d.date));
  const good = new Set(verdict.good.map((d) => d.date));
  return (
    <>
      <p className={cn('mt-2 text-meta', verdict.needsAlternatives && 'font-semibold text-bad-fg')}>
        {verdict.sentence}
      </p>
      <ol className="mt-3 flex gap-1.5 overflow-x-auto pb-1" aria-label="Météo jour par jour">
        {days.map((d) => {
          const w = weatherInWords(d)[0];
          const risky = hasExterior && bad.has(d.date);
          const label = format(parseISO(d.date), 'EEEE d MMMM', { locale: fr });
          return (
            <li
              key={d.date}
              className={cn(
                'flex min-w-16 flex-col items-center gap-0.5 border px-1.5 py-1.5 text-label',
                risky
                  ? 'border-bad-fg bg-bad-bg text-bad-fg'
                  : hasExterior && good.has(d.date)
                    ? 'border-ok-fg/50 bg-ok-bg text-ok-fg'
                    : 'border-line-light text-muted-on-light',
              )}
            >
              <span className="whitespace-nowrap">{format(parseISO(d.date), 'EEE d', { locale: fr })}</span>
              <Icon name={w.icon} size={16} />
              <span className="tabular-nums" aria-hidden>
                {d.rain_pct === null ? '–' : `${d.rain_pct} %`}
              </span>
              <span className="sr-only">
                {label} : {w.text}
                {risky ? ', risque pour les scènes en extérieur' : ''}
              </span>
            </li>
          );
        })}
      </ol>
      {verdict.needsAlternatives ? (
        <p className="mt-3 flex flex-wrap items-center gap-3">
          <Button size="sm" variant="secondary" icon="pin" onClick={onShelteredPlaces}>
            Proposer des lieux abrités
          </Button>
          <span className="text-meta text-muted-on-light">
            Ou garde ce lieu : le planning évite les jours de pluie pour les scènes en extérieur et te le
            signale.
          </span>
        </p>
      ) : null}
    </>
  );
}
