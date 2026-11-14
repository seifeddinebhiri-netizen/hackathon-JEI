import { describe, expect, it } from 'vitest';
import { compassLabel, sunInfo, sunPosition } from './sun';

describe('sun', () => {
  it('donne une position plausible du soleil à Tunis en novembre', () => {
    const afternoon = sunPosition(new Date('2026-11-15T16:00:00+01:00'));
    expect(afternoon.altitude).toBeGreaterThan(0);
    expect(afternoon.altitude).toBeLessThan(40);
    expect(compassLabel(afternoon.azimuth)).toBe('sud-ouest');
    const noon = sunPosition(new Date('2026-11-15T12:20:00+01:00'));
    expect(compassLabel(noon.azimuth)).toBe('sud');
    expect(noon.altitude).toBeLessThan(90);
  });

  it('calcule lever et coucher dans le bon ordre', () => {
    const s = sunInfo(new Date('2026-11-15T12:00:00+01:00'));
    expect(s.dawn < s.sunrise).toBe(true);
    expect(s.sunrise < s.solarNoon && s.solarNoon < s.sunset).toBe(true);
    expect(s.goldenEvening.from < s.sunset).toBe(true);
  });
});
