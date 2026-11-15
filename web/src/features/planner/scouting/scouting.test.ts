import { afterEach, expect, it, vi } from 'vitest';
import { applyScoutChoice } from './handoff';
import { DEFAULT_REQUIREMENTS, getLocationWeather, searchLocations } from './api';
import { localTime, solarTimes } from './solar';
import { PLACE, SLOT, WEATHER } from './fixtures.test-support';
import type { ScoutChoice } from './storage';
import type { PlannerDraft } from '../components/wizard/types';

afterEach(() => vi.unstubAllGlobals());

it('calls the real API wrapper and preserves the provider coordinates', async () => {
  const transport = vi
    .fn()
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          region: 'Tunis',
          center_lat: PLACE.lat,
          center_lon: PLACE.lon,
          category: 'cafe',
          radius_km: 10,
          candidates: [PLACE],
        }),
      ),
    )
    .mockResolvedValueOnce(new Response(JSON.stringify(WEATHER)));
  vi.stubGlobal('fetch', transport);
  const found = await searchLocations({ region: 'Tunis', category: 'cafe', radius_km: 10 });
  await getLocationWeather(found.candidates[0].id, WEATHER.date);
  expect(new URL(transport.mock.calls[0][0]).pathname).toBe('/locations/search');
  expect(new URL(transport.mock.calls[1][0]).pathname).toBe(`/locations/${PLACE.id}/weather`);
  expect(found.candidates[0].lat).toBe(PLACE.lat);
});

it('preserves unrelated planner data while applying a confirmed scouting choice', () => {
  const draft: PlannerDraft = {
    people: [],
    locations: [],
    scenes: [
      {
        id: 'scene1',
        number: '1',
        title: 'INT. CAFÉ',
        setting: 'INT',
        moment: 'jour',
        location_id: '',
        characters: [],
        estimated_hours: 2,
        summary: '',
        source: 'import_ia',
        validated: true,
      },
    ],
  };
  const choice: ScoutChoice = {
    scene_id: 'project:p:scene1',
    scene_number: '1',
    scene_heading: 'INT. CAFÉ',
    date: WEATHER.date,
    location: PLACE,
    slot: SLOT,
    requirements: DEFAULT_REQUIREMENTS,
    confirmed_at: PLACE.fetched_at,
    timezone: WEATHER.timezone,
  };
  const next = applyScoutChoice(draft, choice);
  expect(next.scenes[0].location_id).toBe(`scout-${PLACE.id}`);
  expect(next.scenes[0].estimated_hours).toBe(2);
  expect(next.locations[0]).toMatchObject({ lat: PLACE.lat, lon: PLACE.lon, permit: 'a_demander' });
  expect(next.locations[0].notes).toContain('10:00');
  expect(applyScoutChoice(draft, { ...choice, scene_id: 'project:other:another-scene' })).toBe(draft);
  expect(applyScoutChoice(next, choice).locations[0].notes).toBe(next.locations[0].notes);
});

it('calculates daylight without fabricated polar events or browser timezone assumptions', () => {
  const sun = solarTimes('2026-06-21', 'Europe/Oslo', 89, 10);
  expect(sun.sunrise).toBeNull();
  expect(sun.sunset).toBeNull();
  expect(localTime(null, 'UTC')).toBe('Indisponible');
  expect(localTime('2026-11-16T09:00:00Z', 'Africa/Tunis')).toBe('10:00');
  const island = solarTimes('2026-11-16', 'Pacific/Kiritimati', 1.87, -157.4);
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Pacific/Kiritimati', day: '2-digit' }).format(
    island.sunrise!,
  );
  expect(parts).toBe('16');
});
