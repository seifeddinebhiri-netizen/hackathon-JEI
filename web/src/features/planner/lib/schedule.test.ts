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
