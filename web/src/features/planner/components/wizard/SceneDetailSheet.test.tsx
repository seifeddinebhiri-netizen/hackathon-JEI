import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '@/api';
import { mockDetailScene } from '@/api/mocks/sceneDetail';
import type { Scene, SceneDetail } from '@/api/types';
import { SceneDetailSheet } from './SceneDetailSheet';

afterEach(() => vi.restoreAllMocks());

const film = { title: 'Marée basse', format: 'court' as const, city: 'Tunis' };
const scene: Scene = {
  id: 's3',
  number: '3',
  title: 'Dispute au frigo',
  setting: 'INT',
  moment: 'nuit',
  location_id: 'loc-appart',
  characters: ['Slim', 'Amira'],
  estimated_hours: 1,
  summary: 'Slim et Amira se disputent.',
  excerpt: 'Slim et Amira se disputent dans la cuisine. La lumière du frigo éclaire leurs visages.',
  source: 'import_ia',
  validated: false,
};

describe('fiche de démo', () => {
  it('ne reprend que ce qui est dans le texte', () => {
    const d = mockDetailScene({ film, scene: { ...scene, decor: 'Appartement' } });
    expect(d.props).toEqual(['Frigo']);
    expect(d.costumes).toEqual([]);
    expect(d.special).toEqual([]);
    expect(d.what_happens).toContain('Slim et Amira se disputent');
    expect(d.watch_out[0]).toMatch(/nuit/i);
  });
});

describe('SceneDetailSheet', () => {
  it('écrit la fiche et l’enregistre avec la scène', async () => {
    const detail: SceneDetail = {
      ...mockDetailScene({ film, scene: { ...scene, decor: '' } }),
      model: 'test',
    };
    const spy = vi.spyOn(api, 'detailScene').mockResolvedValue(detail);
    const onChange = vi.fn();
    render(
      <QueryClientProvider client={new QueryClient()}>
        <SceneDetailSheet scene={scene} film={film} decor="Appartement" onChange={onChange} />
      </QueryClientProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: /Détailler la scène/ }));
    await vi.waitFor(() => expect(onChange).toHaveBeenCalledWith(detail));
    expect(spy.mock.calls[0][0].scene).toMatchObject({ number: '3', decor: 'Appartement', moment: 'nuit' });
    expect(spy.mock.calls[0][0].scene.excerpt).toContain('frigo');
  });

  it('affiche la fiche existante et permet de la retirer', async () => {
    const onChange = vi.fn();
    const detail = mockDetailScene({ film, scene: { ...scene, decor: '' } });
    render(
      <QueryClientProvider client={new QueryClient()}>
        <SceneDetailSheet scene={{ ...scene, detail }} film={film} decor="" onChange={onChange} />
      </QueryClientProvider>,
    );
    expect(screen.getByLabelText('Ce qui se passe')).toHaveValue(detail.what_happens);
    await userEvent.click(screen.getByRole('button', { name: /Retirer la fiche/ }));
    expect(onChange).toHaveBeenCalledWith(undefined);
  });
});
