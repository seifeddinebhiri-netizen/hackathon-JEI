import { describe, expect, it } from 'vitest';
import type { Location, Schedule, Scene } from '@/api/types';
import { pruneSchedule, removeScene, restoreScene, scheduleHasScene } from './removeScene';

const loc = (id: string): Location => ({
  id,
  name: id,
  address: '',
  forbidden_days: [],
  permit: 'a_demander',
});
const scene = (id: string, location_id: string): Scene => ({
  id,
  number: id,
  title: id,
  setting: 'INT',
  moment: 'jour',
  location_id,
  characters: [],
  estimated_hours: 1,
  summary: '',
  source: 'manuel',
  validated: true,
});

const draft = {
  scenes: [scene('s1', 'port'), scene('s2', 'port'), scene('s3', 'maison')],
  locations: [loc('port'), loc('maison'), loc('vide')],
  people: [],
};

describe('removeScene', () => {
  it('keeps a location still used by another scene', () => {
    const { draft: next, removal } = removeScene(draft, 's1');
    expect(next.scenes.map((s) => s.id)).toEqual(['s2', 's3']);
    expect(next.locations.map((l) => l.id)).toEqual(['port', 'maison', 'vide']);
    expect(removal?.locations).toEqual([]);
  });

  it('removes a location used by no other scene', () => {
    const { draft: next, removal } = removeScene(draft, 's3');
    expect(next.locations.map((l) => l.id)).toEqual(['port', 'vide']);
    expect(removal?.locations.map((l) => l.location.id)).toEqual(['maison']);
  });

  it('never touches a location that had no scene', () => {
    const { draft: next } = removeScene(draft, 's3');
    expect(next.locations.some((l) => l.id === 'vide')).toBe(true);
  });

  it('undo restores the scene and its locations in place', () => {
    const { draft: next, removal } = removeScene(draft, 's3');
    const back = restoreScene({ ...next, scenes: [...next.scenes, scene('s4', 'port')] }, removal!);
    expect(back.scenes.map((s) => s.id)).toEqual(['s1', 's2', 's3', 's4']);
    expect(back.locations.map((l) => l.id)).toEqual(['port', 'maison', 'vide']);
    expect(restoreScene(back, removal!)).toBe(back); // deux annulations : pas de doublon
  });

  it('ignores an unknown scene', () => {
    expect(removeScene(draft, 'nope').removal).toBeNull();
  });
});

describe('pruneSchedule', () => {
  const schedule: Schedule = {
    generated_at: '2026-11-19T10:00:00',
    status: 'brouillon_ia',
    days: [
      {
        date: '2026-12-01',
        location_ids: ['port', 'maison'],
        call_time: '08:00',
        scenes: [
          { scene_id: 's1', start: '2026-12-01T08:00:00', end: '2026-12-01T09:00:00', conflicts: [] },
          { scene_id: 's3', start: '2026-12-01T10:00:00', end: '2026-12-01T11:00:00', conflicts: [] },
        ],
      },
      {
        date: '2026-12-02',
        location_ids: ['maison'],
        call_time: '08:00',
        scenes: [
          {
            scene_id: 's3',
            start: '2026-12-02T08:00:00',
            end: '2026-12-02T09:00:00',
            conflicts: [{ kind: 'autorisation_manquante', message: 'Autorisation à demander' }],
          },
        ],
      },
    ],
    unplaced: [{ scene_id: 's3', reason: 'x' }],
  };

  it('drops the scene, its orphan locations, empty days and their reminders', () => {
    const { removal } = removeScene(draft, 's3');
    expect(scheduleHasScene(schedule, 's3')).toBe(true);
    const next = pruneSchedule(schedule, removal!);
    expect(next.days.map((d) => d.date)).toEqual(['2026-12-01']); // le 2 n'avait que s3
    expect(next.days[0].location_ids).toEqual(['port']);
    expect(next.days[0].scenes.map((s) => s.scene_id)).toEqual(['s1']);
    expect(next.unplaced).toEqual([]);
    expect(scheduleHasScene(next, 's3')).toBe(false);
  });
});
