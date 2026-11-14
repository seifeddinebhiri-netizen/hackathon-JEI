import type { Scene, ScheduleConflict, WeatherDay } from '@/api/types';
import { Icon, StatusChip } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatTime } from '@/lib/format';
import { CONFLICT_ICONS, CONFLICT_TONES, MOMENT_ICONS, MOMENT_LABELS } from '../lib/labels';
import { CONFLICT_LABELS, isWeatherKnown } from '../lib/rules';

/** INT / EXT : toujours en texte, la couleur ne fait que renforcer. */
export function SettingTag({ setting, className }: { setting: Scene['setting']; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center border px-1.5 font-mono text-label font-medium',
        setting === 'EXT' ? 'border-ink bg-gold text-ink' : 'border-ink bg-white text-ink',
        className,
      )}
    >
      {setting}
    </span>
  );
}

export function MomentTag({ moment, className }: { moment: Scene['moment']; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 text-meta', className)}>
      <Icon name={MOMENT_ICONS[moment]} size={16} />
      {MOMENT_LABELS[moment]}
    </span>
  );
}

export function ConflictChip({ conflict }: { conflict: ScheduleConflict }) {
  return (
    <StatusChip
      tone={CONFLICT_TONES[conflict.kind]}
      icon={CONFLICT_ICONS[conflict.kind]}
      title={conflict.message}
    >
      {CONFLICT_LABELS[conflict.kind]}
    </StatusChip>
  );
}

export function ConflictList({
  conflicts,
  className,
}: {
  conflicts: ScheduleConflict[];
  className?: string;
}) {
  if (!conflicts.length) return null;
  return (
    <ul className={cn('flex flex-col gap-1.5', className)}>
      {conflicts.map((c, i) => (
        <li key={`${c.kind}-${i}`} className="flex items-start gap-2 text-meta">
          <Icon name={CONFLICT_ICONS[c.kind]} size={16} className="mt-0.5 shrink-0" />
          <span>
            <strong className="font-semibold">{CONFLICT_LABELS[c.kind]} : </strong>
            {c.message}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Météo d'un jour. Hors horizon : jamais de chiffres inventés. */
export function WeatherSummary({ weather, compact }: { weather?: WeatherDay; compact?: boolean }) {
  if (!weather) return <span className="text-meta text-muted-on-light">Météo non chargée</span>;
  if (!isWeatherKnown(weather)) {
    return (
      <span className="inline-flex items-center gap-1.5 text-meta font-semibold text-warn-fg">
        <Icon name="cloud" size={16} /> Météo à revérifier
      </span>
    );
  }
  const rainy = weather.rain_pct >= 40;
  const windy = weather.wind_kmh >= 40;
  if (compact) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 text-meta',
          (rainy || windy) && 'font-semibold text-bad-fg',
        )}
      >
        <Icon name={rainy ? 'rain' : windy ? 'wind' : weather.cloud_pct > 50 ? 'cloud' : 'sun'} size={16} />
        {rainy
          ? `Pluie ${weather.rain_pct} %`
          : windy
            ? `Vent ${weather.wind_kmh} km/h`
            : `Pluie ${weather.rain_pct} %`}
      </span>
    );
  }
  return (
    <span className="flex flex-wrap gap-x-4 gap-y-1 text-meta">
      <span className={cn('inline-flex items-center gap-1', rainy && 'font-semibold text-bad-fg')}>
        <Icon name="rain" size={16} /> Pluie {weather.rain_pct} %
      </span>
      <span className={cn('inline-flex items-center gap-1', windy && 'font-semibold text-bad-fg')}>
        <Icon name="wind" size={16} /> Vent {weather.wind_kmh} km/h
      </span>
      <span className="inline-flex items-center gap-1">
        <Icon name="cloud" size={16} /> Nuages {weather.cloud_pct} %
      </span>
    </span>
  );
}

export function SunTimes({ weather }: { weather?: WeatherDay }) {
  if (!weather) return null;
  return (
    <span className="flex flex-wrap gap-x-4 gap-y-1 text-meta">
      <span className="inline-flex items-center gap-1">
        <Icon name="sunrise" size={16} /> Lever {formatTime(weather.sunrise)}
      </span>
      <span className="inline-flex items-center gap-1">
        <Icon name="sunset" size={16} /> Coucher {formatTime(weather.sunset)}
      </span>
    </span>
  );
}
