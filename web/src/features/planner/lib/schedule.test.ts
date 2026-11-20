import { describe, expect, it } from 'vitest';
import { buildDemoProject } from '@/api/mocks/data/project';
import { mockSchedule } from '@/api/mocks/scheduler';
import { mockWeatherRange } from '@/api/mocks/weather';
import { findScene, moveScene, reorderDay } from './schedule';

function setup() {
  const project = buildDemoProject();
  const w = mockWeatherRange(project.shooting_window.from, project.shooting_window.to, 36.8, 10.18);
  const weather = new Map(w.map((x) => [x.date, x]));
  return { project, weather, schedule: mockSchedule(project, w) };
}

describe('moveScene', () => {
  it('déplace une scène vers un autre jour et recalcule les deux jours', () => {
    const { project, weather, schedule } = setup();
    const from = schedule.days[0];
    const sceneId = from.scenes[0].scene_id;
    const target = [...weather.keys()].find((d) => !schedule.days.some((x) => x.date === d))!;
    const next = moveScene(schedule, sceneId, target, { project, weather });
    expect(findScene(next, sceneId)).toBe(target);
    expect(next.days.find((d) => d.date === target)!.scenes).toHaveLength(1);
    const total = (s: typeof next) => s.days.reduce((n, d) => n + d.scenes.length, 0) + s.unplaced.length;
    expect(total(next)).toBe(total(schedule));
  });

  it('retire une scène du planning et la remet', () => {
    const { project, weather, schedule } = setup();
    const sceneId = schedule.days[0].scenes[0].scene_id;
    const out = moveScene(schedule, sceneId, null, { project, weather });
    expect(findScene(out, sceneId)).toBe('unplaced');
    const back = moveScene(out, sceneId, schedule.days[0].date, { project, weather });
    expect(findScene(back, sceneId)).toBe(schedule.days[0].date);
    expect(back.unplaced).toHaveLength(0);
  });

  it('signale la pluie quand une scène EXT est déposée un jour pluvieux', () => {
    const { project, weather, schedule } = setup();
    const ext = project.scenes.find((s) => s.setting === 'EXT' && s.moment === 'jour')!;
    const rainy = [...weather.values()].find((w) => w.forecast === 'prevision' && (w.rain_pct ?? 0) >= 40)!;
    const next = moveScene(schedule, ext.id, rainy.date, { project, weather });
    const placed = next.days.find((d) => d.date === rainy.date)!.scenes.find((s) => s.scene_id === ext.id)!;
    expect(placed.conflicts.map((c) => c.kind)).toContain('pluie');
  });
});

describe('reorderDay', () => {
  it('respecte l’ordre manuel des scènes « jour »', () => {
    const { project, weather, schedule } = setup();
    const day = schedule.days.find((d) => {
      const jour = d.scenes.filter((s) => project.scenes.find((x) => x.id === s.scene_id)!.moment === 'jour');
      return jour.length >= 2;
    })!;
    const jourIds = day.scenes
      .map((s) => s.scene_id)
      .filter((id) => project.scenes.find((x) => x.id === id)!.moment === 'jour');
    const reversed = [...jourIds].reverse();
    const next = reorderDay(schedule, day.date, reversed, { project, weather });
    const ordered = next.days
      .find((d) => d.date === day.date)!
      .scenes.filter((s) => jourIds.includes(s.scene_id))
      .map((s) => s.scene_id);
    expect(ordered).toEqual(reversed);
  });
});

describe('horaires conservés et frise', () => {
  it('garde les horaires des autres scènes quand une scène arrive', () => {
    const { project, weather, schedule } = setup();
    const day = schedule.days[0];
    const before = new Map(day.scenes.map((s) => [s.scene_id, s.start]));
    const other = schedule.days[1].scenes[0].scene_id;
    const next = moveScene(schedule, other, day.date, { project, weather });
    const after = next.days.find((d) => d.date === day.date)!;
    for (const [id, start] of before) expect(after.scenes.find((s) => s.scene_id === id)!.start).toBe(start);
  });

  it('pose une scène à une heure précise et refuse un chevauchement', async () => {
    const { moveSceneToTime } = await import('./schedule');
    const { project, weather, schedule } = setup();
    const day = schedule.days.find((d) => d.scenes.length >= 2)!;
    const [a, b] = day.scenes;
    const clash = moveSceneToTime(schedule, b.scene_id, day.date, a.start.slice(11, 16), {
      project,
      weather,
    });
    expect('error' in clash && clash.error).toBe('chevauchement');
    const ok = moveSceneToTime(schedule, b.scene_id, day.date, '21:30', { project, weather });
    expect('schedule' in ok).toBe(true);
    if ('schedule' in ok) {
      const moved = ok.schedule.days
        .find((d) => d.date === day.date)!
        .scenes.find((s) => s.scene_id === b.scene_id)!;
      expect(moved.start.slice(11, 16)).toBe('21:30');
    }
  });
});

describe('conflits regroupés', () => {
  it('regroupe l’autorisation à demander par lieu', async () => {
    const { groupConflicts } = await import('./schedule');
    const { project, schedule } = setup();
    const groups = groupConflicts(schedule, project);
    const permit = groups.filter((g) => g.kind === 'autorisation_manquante');
    expect(permit).toHaveLength(1);
    expect(permit[0].locationId).toBe('loc-medina');
    expect(permit[0].sceneIds.length).toBe(3);
  });

  it('propose un jour qui supprime la pluie', async () => {
    const { groupConflicts, suggestMove } = await import('./schedule');
    const { project, weather, schedule } = setup();
    const ext = project.scenes.find((s) => s.setting === 'EXT' && s.moment === 'jour')!;
    const rainy = [...weather.values()].find((w) => w.forecast === 'prevision' && (w.rain_pct ?? 0) >= 40)!;
    const wet = moveScene(schedule, ext.id, rainy.date, { project, weather });
    const g = groupConflicts(wet, project).find((x) => x.kind === 'pluie')!;
    const windowDates = [...weather.keys()];
    const date = suggestMove(wet, g.sceneIds, 'pluie', { project, weather, windowDates });
    expect(date).toBeDefined();
    const fixed = moveScene(wet, ext.id, date!, { project, weather });
    const sc = fixed.days.find((d) => d.date === date)!.scenes.find((s) => s.scene_id === ext.id)!;
    expect(sc.conflicts.some((c) => c.kind === 'pluie')).toBe(false);
  });
});

describe('lumière non respectée', () => {
  it('ne signale rien pour une scène calée sur sa lumière par le planning', () => {
    const { schedule } = setup();
    const all = schedule.days.flatMap((d) => d.scenes.flatMap((s) => s.conflicts.map((c) => c.kind)));
    expect(all).not.toContain('lumiere_non_respectee');
  });

  it('signale une scène « lumière du soir » posée en plein après-midi, et propose sa bande', async () => {
    const { moveSceneToTime } = await import('./schedule');
    const { lightBand } = await import('./rules');
    const { conflictSentence } = await import('./labels');
    const { project, weather, schedule } = setup();
    const golden = project.scenes.find((s) => s.moment === 'heure_doree')!;
    const date = schedule.days.find((d) => d.scenes.some((s) => s.scene_id === golden.id))!.date;
    const r = moveSceneToTime(schedule, golden.id, date, '13:00', { project, weather });
    if (!('schedule' in r)) throw new Error('horaire refusé');
    const placed = r.schedule.days
      .find((d) => d.date === date)!
      .scenes.find((s) => s.scene_id === golden.id)!;
    const conflict = placed.conflicts.find((c) => c.kind === 'lumiere_non_respectee')!;
    expect(conflict.message).toBe(
      'La scène est écrite en lumière du soir, mais elle est surtout tournée en plein jour.',
    );
    const loc = project.locations.find((l) => l.id === golden.location_id);
    const s = conflictSentence(conflict, golden, loc, { date });
    expect(s.action?.kind).toBe('shift');
    // « Décaler à » le début de la bande, arrondi au quart d'heure supérieur
    const band = lightBand('heure_doree', date, loc)!;
    const hhmm = s.action?.kind === 'shift' ? s.action.hhmm : '';
    const [h, m] = hhmm.split(':').map(Number);
    const start = band.start.getHours() * 60 + band.start.getMinutes();
    expect(h * 60 + m - start).toBeGreaterThanOrEqual(0);
    expect(h * 60 + m - start).toBeLessThan(15);
    expect(s.action?.label).toMatch(/^Décaler à \d{1,2} h \d{2}$/);
  });
});
