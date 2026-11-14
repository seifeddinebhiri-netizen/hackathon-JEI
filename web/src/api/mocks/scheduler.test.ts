import { describe, expect, it } from 'vitest';
import { scheduleSchema } from '../schemas';
import { buildDemoProject } from './data/project';
import { parseScreenplayText } from './parser';
import { mockSchedule } from './scheduler';
import { mockWeatherRange } from './weather';
import { isForbiddenDay, isRainy } from '@/features/planner/lib/rules';

function run() {
  const p = buildDemoProject();
  const w = mockWeatherRange(p.shooting_window.from, p.shooting_window.to, 36.8, 10.18);
  return { p, w, s: mockSchedule(p, w) };
}

describe('mockSchedule', () => {
  it('respecte le contrat zod', () => {
    expect(() => scheduleSchema.parse(run().s)).not.toThrow();
  });

  it('place toutes les scènes de la démo', () => {
    const { p, s } = run();
    const placed = s.days.flatMap((d) => d.scenes.map((x) => x.scene_id));
    expect(placed.length + s.unplaced.length).toBe(p.scenes.length);
    expect(s.unplaced).toHaveLength(0);
  });

  it('regroupe les scènes d’un même lieu le même jour', () => {
    const { s } = run();
    for (const d of s.days) expect(d.location_ids).toHaveLength(1);
  });

  it('ne met jamais un lieu un jour interdit, ni une scène EXT un jour de pluie connue', () => {
    const { p, s } = run();
    for (const d of s.days) {
      for (const sc of d.scenes) {
        const scene = p.scenes.find((x) => x.id === sc.scene_id)!;
        const loc = p.locations.find((l) => l.id === scene.location_id);
        expect(isForbiddenDay(loc, d.date)).toBe(false);
        if (scene.setting === 'EXT') expect(isRainy(d.weather)).toBe(false);
      }
    }
  });

  it('signale l’autorisation manquante pour la médina', () => {
    const { s } = run();
    const kinds = s.days.flatMap((d) => d.scenes.flatMap((x) => x.conflicts.map((c) => c.kind)));
    expect(kinds).toContain('autorisation_manquante');
  });

  it('respecte le maximum d’heures par jour', () => {
    const { p, s } = run();
    for (const d of s.days) {
      const h = d.scenes.reduce((n, x) => n + p.scenes.find((sc) => sc.id === x.scene_id)!.estimated_hours, 0);
      expect(h).toBeLessThanOrEqual(p.max_hours_per_day);
    }
  });
});

describe('parseScreenplayText', () => {
  it('découpe les en-têtes INT/EXT et détecte les personnages', () => {
    const r = parseScreenplayText(
      [
        'INT. CAFÉ - JOUR',
        'Amira lève le rideau.',
        '',
        'MOUNIR',
        'Le café est vendu.',
        '',
        'EXT. PLAGE - CRÉPUSCULE',
        'Amira marche seule.',
      ].join('\n'),
    );
    expect(r.scenes).toHaveLength(2);
    expect(r.scenes[0]).toMatchObject({ setting: 'INT', moment: 'jour', validated: false, source: 'import_ia' });
    expect(r.scenes[1]).toMatchObject({ setting: 'EXT', moment: 'heure_doree' });
    expect(r.characters).toContain('Mounir');
    expect(r.locations.map((l) => l.name)).toEqual(['Café', 'Plage']);
  });
});

describe('mockWeatherDay', () => {
  it('renvoie null au-delà de l’horizon de prévision', async () => {
    const { mockWeatherDay } = await import('./weather');
    const { addDays } = await import('date-fns');
    const far = mockWeatherDay(addDays(new Date(), 20), 36.8, 10.18);
    expect(far).toMatchObject({ forecast: 'hors_horizon', rain_pct: null, wind_kmh: null, cloud_pct: null });
    const near = mockWeatherDay(addDays(new Date(), 2), 36.8, 10.18);
    expect(near.forecast).toBe('prevision');
    expect(typeof near.rain_pct).toBe('number');
  });
});
