import * as SunCalc from 'suncalc';

export type SunInfo = {
  sunrise: Date;
  sunset: Date;
  /** Heure dorée du matin */
  goldenMorning: { from: Date; to: Date };
  /** Heure dorée du soir */
  goldenEvening: { from: Date; to: Date };
  /** Aube civile */
  dawn: Date;
  /** Crépuscule civil */
  dusk: Date;
  solarNoon: Date;
};

/** Coordonnées par défaut : Tunis. */
export const TUNIS = { lat: 36.8065, lon: 10.1815 } as const;

export function sunInfo(date: Date, lat: number = TUNIS.lat, lon: number = TUNIS.lon): SunInfo {
  // Midi local pour éviter les décalages de jour
  const noon = new Date(date);
  noon.setHours(12, 0, 0, 0);
  const t = SunCalc.getTimes(noon, lat, lon);
  // suncalc renvoie null aux latitudes polaires ; jamais en Tunisie, mais on reste défensif.
  const at = (d: Date | null, h: number) => d ?? new Date(new Date(noon).setHours(h, 0, 0, 0));
  const sunrise = at(t.sunrise, 7);
  const sunset = at(t.sunset, 18);
  return {
    sunrise,
    sunset,
    goldenMorning: { from: sunrise, to: at(t.goldenHourEnd, 8) },
    goldenEvening: { from: at(t.goldenHour, 17), to: sunset },
    dawn: at(t.dawn, 6),
    dusk: at(t.dusk, 19),
    solarNoon: at(t.solarNoon, 12),
  };
}

/** Azimut du soleil en degrés (0 = nord, 90 = est) et hauteur en degrés. */
export function sunPosition(at: Date, lat: number = TUNIS.lat, lon: number = TUNIS.lon) {
  // suncalc v2 renvoie déjà des degrés, azimut compté depuis le nord dans le sens horaire.
  const p = SunCalc.getPosition(at, lat, lon);
  return { azimuth: ((p.azimuth % 360) + 360) % 360, altitude: p.altitude };
}

const DIRECTIONS = ['nord', 'nord-est', 'est', 'sud-est', 'sud', 'sud-ouest', 'ouest', 'nord-ouest'];
export function compassLabel(azimuth: number): string {
  return DIRECTIONS[Math.round(azimuth / 45) % 8];
}
