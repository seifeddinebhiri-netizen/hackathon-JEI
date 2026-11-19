import { describe, expect, it } from 'vitest';
import type { Project } from '@/api/types';
import { plannerStepsDone } from './steps';

const base = {
  scenes: [{ id: 's1', location_id: 'l1' }],
  locations: [{ id: 'l1', address: '' }],
  people: [{ kind: 'equipe' }],
  schedule: { days: [] },
} as unknown as Project;

describe('plannerStepsDone', () => {
  it('ticks Lieux even when an address is missing', () => {
    expect(plannerStepsDone(base)).toEqual([true, true, true, true, true]);
  });

  it('leaves Lieux unticked when a scene has no known location', () => {
    const p = { ...base, scenes: [{ id: 's1', location_id: 'nope' }] } as unknown as Project;
    expect(plannerStepsDone(p)[2]).toBe(false);
  });

  it('nothing is done without a project', () => {
    expect(plannerStepsDone(undefined)).toEqual([false, false, false, false, false]);
  });
});
