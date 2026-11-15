import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import PlannerScouting from './PlannerScouting';
import { DEMO, EXAMPLE_CONTENT } from '@/features/planner/scenario/demo';
import { SESSION_KEY } from '@/features/planner/scenario/storage';
import { SCOUTING_KEY } from '@/features/planner/scouting/storage';
import { evaluateLocations, getLocationWeather, searchLocations } from '@/features/planner/scouting/api';
import { EVALUATION, PLACE, WEATHER } from '@/features/planner/scouting/fixtures.test-support';

vi.mock('@/features/project/hooks/useProject', () => ({
  useCurrentProject: () => ({ data: undefined, isError: false }),
}));
vi.mock('@/features/planner/scouting/ScoutingMap', () => ({
  default: () => <div>Carte Leaflet (test)</div>,
}));
vi.mock('@/features/planner/scouting/api', async (original) => ({
  ...(await original<typeof import('@/features/planner/scouting/api')>()),
  searchLocations: vi.fn(),
  getLocationWeather: vi.fn(),
  evaluateLocations: vi.fn(),
  interpretScene: vi.fn(),
}));
beforeEach(() => {
  sessionStorage.clear();
  vi.clearAllMocks();
  sessionStorage.setItem(
    SESSION_KEY,
    JSON.stringify({ title: DEMO.title, content: EXAMPLE_CONTENT, analysis: DEMO, confirmed: true }),
  );
  vi.mocked(searchLocations).mockResolvedValue({
    region: 'Tunis',
    center_lat: PLACE.lat,
    center_lon: PLACE.lon,
    category: 'cafe',
    radius_km: 10,
    candidates: [PLACE],
  });
  vi.mocked(getLocationWeather).mockResolvedValue(WEATHER);
  vi.mocked(evaluateLocations).mockResolvedValue([EVALUATION]);
});
afterEach(cleanup);
function mount() {
  render(
    <MemoryRouter>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <PlannerScouting />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}
function fill() {
  const selector = screen.getByLabelText('Scène à repérer');
  fireEvent.change(selector, { target: { value: (selector as HTMLSelectElement).options[1].value } });
  fireEvent.change(screen.getByLabelText('Région de recherche'), { target: { value: 'Tunis, Tunisie' } });
  fireEvent.change(screen.getByLabelText('Date de tournage'), { target: { value: '2026-11-16' } });
}

it('requires scene and region before searching providers', () => {
  mount();
  fireEvent.click(screen.getByText('Rechercher des lieux réels'));
  expect(screen.getByRole('alert')).toHaveTextContent('Sélectionne une scène');
  expect(searchLocations).not.toHaveBeenCalled();
});

it('searches, automatically loads weather, compares and confirms a real location/time', async () => {
  mount();
  fill();
  fireEvent.click(screen.getByText('Rechercher des lieux réels'));
  fireEvent.click(await screen.findByText(`Voir la météo de ${PLACE.name}`));
  await waitFor(() => expect(getLocationWeather).toHaveBeenCalledWith(PLACE.id, '2026-11-16'));
  expect(await screen.findByText(/Heures locales : Africa\/Tunis/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('checkbox', { name: `Comparer ${PLACE.name}` }));
  fireEvent.click(screen.getByText('Comparer 1 lieu(x)'));
  const slot = await screen.findByRole('button', { name: /Choisir ce créneau/ });
  fireEvent.click(slot);
  const confirm = screen.getByText('Confirmer ce lieu et cette heure');
  expect(confirm).toBeDisabled();
  fireEvent.click(screen.getByRole('checkbox', { name: /J’ai revu ces critères/ }));
  fireEvent.click(confirm);
  const stored = JSON.parse(sessionStorage.getItem(SCOUTING_KEY)!);
  expect(stored[0].location.lat).toBe(PLACE.lat);
  expect(stored[0].slot.start).toBe(EVALUATION.slots[0].start);
  expect(screen.getByText('Repérages confirmés · session de cet onglet')).toBeInTheDocument();
  fireEvent.click(screen.getByText(`Retirer ce choix · ${PLACE.name}`));
  expect(JSON.parse(sessionStorage.getItem(SCOUTING_KEY)!)).toEqual([]);
});

it('does not create weather or fake places when providers fail', async () => {
  vi.mocked(searchLocations).mockRejectedValue(new Error('Configure GEOAPIFY_API_KEY'));
  mount();
  fill();
  fireEvent.click(screen.getByText('Rechercher des lieux réels'));
  expect(await screen.findByRole('alert')).toHaveTextContent('GEOAPIFY_API_KEY');
  expect(getLocationWeather).not.toHaveBeenCalled();
  expect(screen.queryByText(PLACE.name)).not.toBeInTheDocument();
});

it('explicitly displays unavailable forecasts outside the horizon', async () => {
  vi.mocked(getLocationWeather).mockResolvedValue({
    ...WEATHER,
    status: 'unavailable',
    reason: 'Date hors horizon',
    hours: [],
    sunrise: null,
    sunset: null,
  });
  mount();
  fill();
  fireEvent.click(screen.getByText('Rechercher des lieux réels'));
  fireEvent.click(await screen.findByText(`Voir la météo de ${PLACE.name}`));
  expect(await screen.findByText(/Prévision indisponible : Date hors horizon/)).toBeInTheDocument();
});

it('revokes a pending selection when date or production criteria change', async () => {
  mount();
  fill();
  fireEvent.click(screen.getByText('Rechercher des lieux réels'));
  fireEvent.click(await screen.findByRole('checkbox', { name: `Comparer ${PLACE.name}` }));
  fireEvent.click(screen.getByText('Comparer 1 lieu(x)'));
  fireEvent.click(await screen.findByRole('button', { name: /Choisir ce créneau/ }));
  expect(screen.getByText('Validation humaine')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Vent maximal (km/h)'), { target: { value: '15' } });
  expect(screen.queryByText('Validation humaine')).not.toBeInTheDocument();
  expect(sessionStorage.getItem(SCOUTING_KEY)).toBeNull();
});
