import { describe, expect, it, vi } from 'vitest';
import { demoApi, mixedApi, NOT_IN_BACKEND_YET } from './index';
import { parseScreenplay } from './endpoints';
import { getDb } from './mocks/db';
import { mockApi } from './mocks/handlers';
import type { Api } from './endpoints';
import type { Project } from './types';

function fakeApi(label: string): Api {
  return Object.fromEntries(
    Object.keys(mockApi).map((name) => [name, vi.fn(async () => `${label}:${name}`)]),
  ) as unknown as Api;
}

describe('mixedApi', () => {
  it('uses the backend for routes that exist and mocks for the others', async () => {
    const api = mixedApi(fakeApi('backend'), fakeApi('mock'));
    expect(await api.createProject({} as never)).toBe('backend:createProject');
    expect(await api.parseScreenplay({})).toBe('backend:parseScreenplay');
    expect(await api.searchFestivals({} as never)).toBe('mock:searchFestivals');
    expect(NOT_IN_BACKEND_YET).not.toContain('createProject');
  });

  it('gives the mock scheduler the real project first', async () => {
    const project = { id: 'real-1', title: 'Vrai' } as Project;
    const backend = { ...fakeApi('backend'), getProject: vi.fn(async () => project) } as Api;
    const mocks = {
      ...fakeApi('mock'),
      generateSchedule: vi.fn(async () => {
        expect(getDb().projects['real-1']).toBe(project);
        return 'schedule';
      }),
    } as unknown as Api;
    const api = mixedApi(backend, mocks);
    expect(await api.generateSchedule({ project_id: 'real-1' } as never)).toBe('schedule');
    expect(backend.getProject).toHaveBeenCalledWith('real-1');
  });
});

describe('demoApi (VITE_REAL_PARSE)', () => {
  it('only sends the screenplay parsing to the backend', () => {
    const mocks = fakeApi('mock');
    const api = demoApi(mocks, true);
    expect(api.parseScreenplay).toBe(parseScreenplay);
    expect(api.createProject).toBe(mocks.createProject);
    expect(api.suggestLocations).toBe(mocks.suggestLocations);
  });

  it('stays fully on mocks when the setting is off', () => {
    const mocks = fakeApi('mock');
    expect(demoApi(mocks, false)).toBe(mocks);
  });
});
