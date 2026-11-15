import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '@/api';
import { buildDemoProject } from '@/api/mocks/data/project';
import { mockSuggestLocations } from '@/api/mocks/locationSuggest';
import { excerptOf } from '@/api/mocks/parser';
import type { Location, LocationSuggestInput } from '@/api/types';
import { locationSuggestKey } from '../../hooks/usePlanner';
import { LocationSuggestions } from './LocationSuggestions';
import { buildSuggestInput } from './locationSuggestInput';

afterEach(() => vi.restoreAllMocks());

const project = {
  ...buildDemoProject(),
  synopsis: { phrase: '', court: 'Amira veut sauver le café.', long: '' },
};
const cafe: Location = {
  id: 'loc-cafe',
  name: 'Petit café de Tunis',
  address: '',
  forbidden_days: [],
  permit: 'non_necessaire',
};
const scenes = project.scenes
  .filter((s) => s.location_id === 'loc-medina')
  .map((s) => ({ ...s, location_id: cafe.id, excerpt: 'INT. CAFÉ — JOUR. Amira lève le rideau.' }));

describe('données envoyées au repérage', () => {
  it('reprend le film, les scènes du décor et les autres décors', () => {
    const input = buildSuggestInput(project, cafe, scenes, ['Rue animée de Tunis', ''], []);
    expect(input.film).toEqual({
      title: 'Marée basse',
      format: 'court',
      city: 'Tunis',
      synopsis: 'Amira veut sauver le café.',
    });
    expect(input.decor).toEqual({ name: 'Petit café de Tunis' });
    expect(input.scenes).toHaveLength(scenes.length);
    expect(input.scenes[0].excerpt).toBe('INT. CAFÉ — JOUR. Amira lève le rideau.');
    expect(input.other_decors).toEqual(['Rue animée de Tunis']);
  });

  it('la clé de cache change seulement si les scènes changent', () => {
    const a = buildSuggestInput(project, cafe, scenes, [], []);
    const b = buildSuggestInput(
      project,
      cafe,
      scenes.map((s) => ({ ...s })),
      [],
      [],
    );
    const c = buildSuggestInput(
      project,
      cafe,
      [{ ...scenes[0], summary: 'Autre chose' }, ...scenes.slice(1)],
      [],
      [],
    );
    expect(locationSuggestKey(a)).toBe(locationSuggestKey(b));
    expect(locationSuggestKey(a)).not.toBe(locationSuggestKey(c));
  });

  it('garde un extrait de 1 200 caractères au plus', () => {
    expect(excerptOf(['', '  Amira entre.  ', 'MOUNIR', 'Bonjour.'])).toBe('Amira entre.\nMOUNIR\nBonjour.');
    expect(excerptOf(['x'.repeat(2000)])!.length).toBe(1200);
    expect(excerptOf(['', ' '])).toBeUndefined();
  });
});

describe('mock des lieux proposés', () => {
  const input = (name: string, exclude: string[] = []): LocationSuggestInput =>
    buildSuggestInput(project, { name }, [], ['Rue animée de Tunis', 'Petit café de Tunis'], exclude);

  it('propose un café de la Médina pour le petit café, une avenue pour la rue', () => {
    const cafeR = mockSuggestLocations(input('Petit café de Tunis'));
    expect(cafeR.propositions).toHaveLength(3);
    expect(cafeR.propositions[0].type_de_lieu).toBe('Café traditionnel de la Médina');
    expect(cafeR.mutualisation).toBe('Rue animée de Tunis');
    const rue = mockSuggestLocations(input('Rue animée de Tunis'));
    expect(rue.propositions[0].candidates[0].name).toBe('Avenue Habib-Bourguiba');
  });

  it('ne repropose pas les types déjà vus', () => {
    const first = mockSuggestLocations(input('Petit café de Tunis'));
    const next = mockSuggestLocations(
      input(
        'Petit café de Tunis',
        first.propositions.map((p) => p.type_de_lieu),
      ),
    );
    const seen = new Set(first.propositions.map((p) => p.type_de_lieu));
    expect(next.propositions.length).toBeGreaterThan(0);
    expect(next.propositions.every((p) => !seen.has(p.type_de_lieu))).toBe(true);
  });
});

describe('LocationSuggestions', () => {
  it('propose des lieux et remplit l’adresse sans toucher au nom du décor', async () => {
    const spy = vi.spyOn(api, 'suggestLocations').mockImplementation(async (i) => mockSuggestLocations(i));
    const onChange = vi.fn();
    render(
      <QueryClientProvider client={new QueryClient()}>
        <LocationSuggestions
          project={project}
          location={cafe}
          scenes={scenes}
          otherDecors={['Rue animée de Tunis']}
          onChange={onChange}
          addressInputId="adresse"
        />
      </QueryClientProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Proposer des lieux pour ce décor' }));
    expect(await screen.findByText('Ce que tes scènes demandent')).toBeInTheDocument();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(screen.getAllByText('Brouillon IA : à valider').length).toBeGreaterThanOrEqual(3);
    expect(screen.getByText(/Ce lieu peut aussi servir pour/)).toBeInTheDocument();
    expect(screen.getAllByText('Autorisation : à demander').length).toBeGreaterThan(0);

    const card = screen.getByRole('heading', { name: 'Café traditionnel de la Médina' }).closest('li')!;
    await userEvent.click(within(card).getAllByRole('button', { name: /Choisir ce lieu/ })[0]);
    const next = onChange.mock.calls[0][0] as Location;
    expect(next.name).toBe('Petit café de Tunis');
    expect(next.address).toBe('Souk Ettrouk, Médina de Tunis, Tunis');
    expect(next.lat).toBeCloseTo(36.7985);
    expect(next.permit).toBe('a_demander');
    expect(next.notes).toBe('Choisi parmi les propositions IA : Café traditionnel de la Médina');

    // Sans candidat : « Chercher moi-même » pré-remplit l'adresse avec la requête
    const empty = screen
      .getByRole('heading', { name: 'Petit café de quartier fermé le matin' })
      .closest('li')!;
    expect(within(empty).getByText('Aucun lieu trouvé automatiquement')).toBeInTheDocument();
    await userEvent.click(within(empty).getByRole('button', { name: 'Chercher moi-même' }));
    expect((onChange.mock.calls[1][0] as Location).address).toBe('café de quartier fermé le matin, Tunis');
  });
});
