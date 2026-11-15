import { describe, expect, it } from 'vitest';
import type { ScheduledScene } from '@/api/types';
import { axisHours, dayRange, pct, placeLabels, snapToHHMM } from './geometry';

const at = (hhmm: string) => `2026-11-22T${hhmm}:00`;
const scene = (from: string, to: string): ScheduledScene => ({
  scene_id: from,
  start: at(from),
  end: at(to),
  conflicts: [],
});

describe('dayRange', () => {
  it('va de (début − 2 h) à (fin + 2 h), arrondi aux heures paires, 8 h au moins', () => {
    expect(dayRange({ scenes: [scene('08:00', '11:15')] })).toEqual({ from: 6, to: 14 });
    expect(dayRange({ scenes: [scene('14:30', '16:00')] })).toEqual({ from: 12, to: 20 });
    expect(dayRange({ scenes: [scene('09:00', '10:00'), scene('17:00', '19:30')] })).toEqual({
      from: 6,
      to: 22,
    });
  });
  it('reste entre 6 h et 24 h', () => {
    expect(dayRange({ scenes: [scene('06:30', '23:00')] })).toEqual({ from: 6, to: 24 });
    expect(dayRange({ scenes: [scene('21:00', '22:30')] })).toEqual({ from: 16, to: 24 });
  });
});

describe('frise', () => {
  it('positions et graduations dépendent de la plage', () => {
    expect(pct(10, { from: 6, to: 14 })).toBe(50);
    expect(axisHours({ from: 6, to: 14 })).toEqual([6, 7, 8, 9, 10, 11, 12, 13, 14]);
    expect(axisHours({ from: 6, to: 24 })).toHaveLength(10);
    expect(snapToHHMM(9.1, 1, { from: 6, to: 14 })).toBe('09:00');
    expect(snapToHHMM(13.9, 2, { from: 6, to: 14 })).toBe('12:00');
  });
  it('les libellés ne se chevauchent jamais et restent dans la frise', () => {
    const placed = placeLabels(
      [
        { x: 100, width: 120 },
        { x: 150, width: 80 },
      ],
      400,
    );
    expect(placed[0]).toEqual({ left: 40, row: 0 });
    expect(placed[1].row).toBe(1);
    expect(placeLabels([{ x: 395, width: 80 }], 400)[0].left).toBe(320);
  });
});
