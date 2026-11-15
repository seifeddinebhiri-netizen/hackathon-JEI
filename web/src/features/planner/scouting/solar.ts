import * as SunCalc from 'suncalc';

export function localTime(value: string | Date | null | undefined, timezone: string): string {
  if (!value || !Number.isFinite(new Date(value).getTime())) return 'Indisponible';
  return new Intl.DateTimeFormat('fr-FR', { timeZone: timezone, hour: '2-digit', minute: '2-digit' }).format(
    new Date(value),
  );
}

/** Resolve civil noon, including fractional offsets and the international date line. */
export function solarTimes(day: string, timezone: string, lat: number, lon: number) {
  const utcNoon = new Date(`${day}T12:00:00Z`);
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(utcNoon);
  const part = (name: string) => Number(parts.find((p) => p.type === name)?.value);
  const offsetMinutes =
    (Date.UTC(part('year'), part('month') - 1, part('day'), part('hour'), part('minute'), part('second')) -
      utcNoon.getTime()) /
    60_000;
  const date = new Date(utcNoon.getTime() - offsetMinutes * 60_000);
  const times = SunCalc.getTimes(date, lat, lon, 0, offsetMinutes);
  const valid = (v: Date | null | undefined) => (v && Number.isFinite(v.getTime()) ? v : null);
  return {
    sunrise: valid(times.sunrise),
    sunset: valid(times.sunset),
    dawn: valid(times.dawn),
    dusk: valid(times.dusk),
    goldenMorningEnd: valid(times.goldenHourEnd),
    goldenEveningStart: valid(times.goldenHour),
  };
}
